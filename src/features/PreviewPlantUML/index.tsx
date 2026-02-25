import { useState, useEffect, useRef, useCallback } from "react";
import { encode } from "plantuml-encoder";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";
import { useTheme } from "next-themes";
import { useAtomValue, useSetAtom } from "jotai";
import { ArrowUpRight, Pencil, Trash2, Check, X } from "lucide-react";
import { ZoomPanContainer } from "@/components/ZoomPanContainer";
import { plantUmlServerUrlAtom } from "@/stores/SettingsStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMessageLines } from "./plantuml-parser";
import { plantUMLJumpAtom } from "./store";

interface PlantUMLPreviewProps {
  content: string;
  onContentChange?: (newContent: string) => void;
}

type PopoverMode = "actions" | "edit" | "confirm-delete";

interface PopoverState {
  open: boolean;
  x: number;
  y: number;
  lineNumber: number;
  sourceLine: string;
  mode: PopoverMode;
}

const POPOVER_CLOSED: PopoverState = {
  open: false,
  x: 0,
  y: 0,
  lineNumber: 0,
  sourceLine: "",
  mode: "actions",
};

/** Extract the label portion after the first colon in a PlantUML message line */
function extractLabel(line: string): string {
  const colonIdx = line.indexOf(":");
  return colonIdx !== -1 ? line.slice(colonIdx + 1).trim() : line.trim();
}

/** Replace the label portion after the first colon in a PlantUML message line */
function replaceLabel(line: string, newLabel: string): string {
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) return line;
  return line.slice(0, colonIdx + 1) + " " + newLabel;
}

export function PlantUMLPreview({ content, onContentChange }: PlantUMLPreviewProps) {
  const [svgContent, setSvgContent] = useState("");
  const { resolvedTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [debouncedContent] = useDebounce(content, 800);
  const plantUmlServerUrl = useAtomValue(plantUmlServerUrlAtom);
  const setJump = useSetAtom(plantUMLJumpAtom);

  const svgWrapperRef = useRef<SVGGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<PopoverState>(POPOVER_CLOSED);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    if (!debouncedContent) {
      setSvgContent("");
      return;
    }

    const fetchDiagram = async () => {
      setLoading(true);
      try {
        const encoded = encode(debouncedContent);

        let url: string;
        if (plantUmlServerUrl) {
          url = `${plantUmlServerUrl}/svg/${encoded}`;
        } else {
          const isDark = resolvedTheme === "dark";
          url = `https://img.plantuml.biz/plantuml/${isDark ? "d" : ""}svg/${encoded}`;
        }

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}: ${res.statusText}`);
        }

        const svg = await res.text();
        setSvgContent(svg);
      } catch (error) {
        console.error("Error fetching SVG from PlantUML server:", error);
        toast.error("Failed to generate UML diagram.");
      } finally {
        setLoading(false);
      }
    };

    fetchDiagram();
  }, [debouncedContent, resolvedTheme, plantUmlServerUrl]);

  // Keep an up-to-date ref of message line numbers
  const messageLines = useRef<number[]>([]);
  useEffect(() => {
    messageLines.current = getMessageLines(content);
  }, [content]);

  // Attach click listeners to each .message element after SVG renders
  useEffect(() => {
    if (!svgWrapperRef.current || !svgContent) return;

    const raf = requestAnimationFrame(() => {
      const wrapper = svgWrapperRef.current;
      if (!wrapper) return;

      const messages = wrapper.querySelectorAll<SVGGElement>(".message");
      const cleanups: (() => void)[] = [];

      messages.forEach((el, idx) => {
        const handler = (e: MouseEvent) => {
          e.stopPropagation();

          const lineNumber = messageLines.current[idx];
          if (!lineNumber) return;

          const sourceLine = content.split("\n")[lineNumber - 1] ?? "";

          const containerRect = containerRef.current?.getBoundingClientRect();
          const x = containerRect ? e.clientX - containerRect.left : e.clientX;
          const y = containerRect ? e.clientY - containerRect.top : e.clientY;

          setPopover({ open: true, x, y, lineNumber, sourceLine, mode: "actions" });
        };

        el.style.cursor = "pointer";
        el.addEventListener("click", handler);
        cleanups.push(() => el.removeEventListener("click", handler));
      });

      return () => cleanups.forEach((fn) => fn());
    });

    return () => cancelAnimationFrame(raf);
  }, [svgContent, content]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleJump = useCallback(() => {
    if (!popover.lineNumber) return;
    setJump({ lineNumber: popover.lineNumber });
    setPopover(POPOVER_CLOSED);
  }, [popover.lineNumber, setJump]);

  const handleOpenEdit = useCallback(() => {
    setEditValue(extractLabel(popover.sourceLine));
    setPopover((p) => ({ ...p, mode: "edit" }));
  }, [popover.sourceLine]);

  const handleEditConfirm = useCallback(() => {
    if (!onContentChange || !popover.lineNumber) return;
    const lines = content.split("\n");
    const idx = popover.lineNumber - 1;
    lines[idx] = replaceLabel(lines[idx], editValue.trim() || extractLabel(lines[idx]));
    onContentChange(lines.join("\n"));
    setPopover(POPOVER_CLOSED);
  }, [content, editValue, onContentChange, popover.lineNumber]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleEditConfirm();
      if (e.key === "Escape") setPopover(POPOVER_CLOSED);
    },
    [handleEditConfirm]
  );

  const handleOpenDelete = useCallback(() => {
    setPopover((p) => ({ ...p, mode: "confirm-delete" }));
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!onContentChange || !popover.lineNumber) return;
    const lines = content.split("\n");
    lines.splice(popover.lineNumber - 1, 1);
    onContentChange(lines.join("\n"));
    setPopover(POPOVER_CLOSED);
  }, [content, onContentChange, popover.lineNumber]);

  const handleContainerClick = useCallback(() => {
    setPopover(POPOVER_CLOSED);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  const renderPopoverContent = () => {
    if (popover.mode === "confirm-delete") {
      return (
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Delete message?</span>
          <Button
            variant="destructive"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleDeleteConfirm}
          >
            Yes
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setPopover(POPOVER_CLOSED)}
          >
            No
          </Button>
        </div>
      );
    }

    if (popover.mode === "edit") {
      return (
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleEditKeyDown}
            className="h-7 text-xs w-48"
            placeholder="Message label…"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-green-500 hover:text-green-400"
            onClick={handleEditConfirm}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setPopover(POPOVER_CLOSED)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      );
    }

    // Default: actions mode
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Jump to line in editor"
          onClick={handleJump}
        >
          <ArrowUpRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Edit message"
          onClick={handleOpenEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          title="Delete message"
          onClick={handleOpenDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </>
    );
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-background relative overflow-hidden"
      onClick={handleContainerClick}
    >
      {loading && (
        <div className="absolute top-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded z-50">
          Rendering...
        </div>
      )}

      <ZoomPanContainer
        className="w-full h-full"
        config={{
          minZoom: 0.1,
          maxZoom: 5,
          initialZoom: 0.8,
          centerOnLoad: true,
        }}
      >
        <g
          ref={svgWrapperRef}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </ZoomPanContainer>

      {/* Floating action popover */}
      {popover.open && (
        <div
          className="absolute z-50 flex items-center gap-1 bg-popover border border-border rounded-md shadow-md p-1"
          style={{ left: popover.x + 8, top: popover.y - 44 }}
          onClick={(e) => e.stopPropagation()}
        >
          {renderPopoverContent()}
        </div>
      )}
    </div>
  );
}
