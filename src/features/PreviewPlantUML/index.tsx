import { useState, useEffect, useRef, useCallback } from "react";
import { encode } from "plantuml-encoder";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";
import { useTheme } from "next-themes";
import { useAtomValue, useSetAtom } from "jotai";
import { ArrowUpRight, Pencil, Trash2, Check, X, Users, Plus } from "lucide-react";
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

type PopoverMode = "actions" | "edit-label" | "edit-participants" | "new-message" | "confirm-delete";

interface PopoverState {
  open: boolean;
  x: number;
  y: number;
  lineNumber: number;
  sourceLine: string;
  mode: PopoverMode;
}

const POPOVER_CLOSED: PopoverState = {
  open: false, x: 0, y: 0, lineNumber: 0, sourceLine: "", mode: "actions",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Everything before the first colon, e.g. "Alice -> Bob" */
function extractParticipants(line: string): string {
  const idx = line.indexOf(":");
  return idx !== -1 ? line.slice(0, idx).trim() : line.trim();
}

/** Everything after the first colon, e.g. "Log attack start" */
function extractLabel(line: string): string {
  const idx = line.indexOf(":");
  return idx !== -1 ? line.slice(idx + 1).trim() : line.trim();
}

/** Replace label (after colon) */
function replaceLabel(line: string, newLabel: string): string {
  const idx = line.indexOf(":");
  if (idx === -1) return line;
  return line.slice(0, idx + 1) + " " + newLabel;
}

/** Replace participants (before colon) */
function replaceParticipants(line: string, newParticipants: string): string {
  const idx = line.indexOf(":");
  if (idx === -1) return newParticipants;
  return newParticipants + " :" + line.slice(idx + 1);
}

// ── Component ─────────────────────────────────────────────────────────────────

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
  const [inputValue, setInputValue] = useState("");

  // ── Fetch SVG ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!debouncedContent) { setSvgContent(""); return; }

    const fetchDiagram = async () => {
      setLoading(true);
      try {
        const encoded = encode(debouncedContent);
        const isDark = resolvedTheme === "dark";
        const url = plantUmlServerUrl
          ? `${plantUmlServerUrl}/svg/${encoded}`
          : `https://img.plantuml.biz/plantuml/${isDark ? "d" : ""}svg/${encoded}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Server returned ${res.status}: ${res.statusText}`);
        setSvgContent(await res.text());
      } catch (error) {
        console.error("Error fetching SVG from PlantUML server:", error);
        toast.error("Failed to generate UML diagram.");
      } finally {
        setLoading(false);
      }
    };

    fetchDiagram();
  }, [debouncedContent, resolvedTheme, plantUmlServerUrl]);

  // ── Message line index ───────────────────────────────────────────────────────

  const messageLines = useRef<number[]>([]);
  useEffect(() => {
    messageLines.current = getMessageLines(content);
  }, [content]);

  // ── Attach click handlers to .message elements ───────────────────────────────

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

  // ── Action handlers ──────────────────────────────────────────────────────────

  const handleJump = useCallback(() => {
    if (!popover.lineNumber) return;
    setJump({ lineNumber: popover.lineNumber });
    setPopover(POPOVER_CLOSED);
  }, [popover.lineNumber, setJump]);

  const openMode = useCallback((mode: PopoverMode, prefill: string) => {
    setInputValue(prefill);
    setPopover((p) => ({ ...p, mode }));
  }, []);

  const applyLineEdit = useCallback((transform: (line: string) => string) => {
    if (!onContentChange || !popover.lineNumber) return;
    const lines = content.split("\n");
    lines[popover.lineNumber - 1] = transform(lines[popover.lineNumber - 1]);
    onContentChange(lines.join("\n"));
    setPopover(POPOVER_CLOSED);
  }, [content, onContentChange, popover.lineNumber]);

  const handleLabelConfirm = useCallback(() => {
    applyLineEdit((line) => replaceLabel(line, inputValue.trim() || extractLabel(line)));
  }, [applyLineEdit, inputValue]);

  const handleParticipantsConfirm = useCallback(() => {
    applyLineEdit((line) => replaceParticipants(line, inputValue.trim() || extractParticipants(line)));
  }, [applyLineEdit, inputValue]);

  const handleNewMessageConfirm = useCallback(() => {
    if (!onContentChange || !popover.lineNumber || !inputValue.trim()) return;
    const lines = content.split("\n");
    lines.splice(popover.lineNumber, 0, inputValue.trim());
    onContentChange(lines.join("\n"));
    setPopover(POPOVER_CLOSED);
  }, [content, inputValue, onContentChange, popover.lineNumber]);

  const handleDeleteConfirm = useCallback(() => {
    if (!onContentChange || !popover.lineNumber) return;
    const lines = content.split("\n");
    lines.splice(popover.lineNumber - 1, 1);
    onContentChange(lines.join("\n"));
    setPopover(POPOVER_CLOSED);
  }, [content, onContentChange, popover.lineNumber]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, onConfirm: () => void) => {
      if (e.key === "Enter") onConfirm();
      if (e.key === "Escape") setPopover(POPOVER_CLOSED);
    },
    []
  );

  const handleContainerClick = useCallback(() => setPopover(POPOVER_CLOSED), []);

  // ── Popover content ──────────────────────────────────────────────────────────

  const renderInlineInput = (placeholder: string, onConfirm: () => void) => (
    <div className="flex items-center gap-1">
      <Input
        autoFocus
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => handleKeyDown(e, onConfirm)}
        className="h-7 text-xs w-52"
        placeholder={placeholder}
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-green-500 hover:text-green-400"
        onClick={onConfirm}
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

  const renderPopoverContent = () => {
    switch (popover.mode) {
      case "edit-label":
        return renderInlineInput("Message label…", handleLabelConfirm);

      case "edit-participants":
        return renderInlineInput("e.g. Alice -> Bob", handleParticipantsConfirm);

      case "new-message":
        return renderInlineInput("e.g. Alice -> Bob: Hello", handleNewMessageConfirm);

      case "confirm-delete":
        return (
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Delete message?</span>
            <Button variant="destructive" size="sm" className="h-6 px-2 text-xs" onClick={handleDeleteConfirm}>
              Yes
            </Button>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setPopover(POPOVER_CLOSED)}>
              No
            </Button>
          </div>
        );

      default: // "actions"
        return (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Jump to line" onClick={handleJump}>
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Edit message label"
              onClick={() => openMode("edit-label", extractLabel(popover.sourceLine))}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Edit participants & arrow"
              onClick={() => openMode("edit-participants", extractParticipants(popover.sourceLine))}
            >
              <Users className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Add message after this one"
              onClick={() => openMode("new-message", "")}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              title="Delete message"
              onClick={() => setPopover((p) => ({ ...p, mode: "confirm-delete" }))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        );
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

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
        config={{ minZoom: 0.1, maxZoom: 5, initialZoom: 0.8, centerOnLoad: true }}
      >
        <g ref={svgWrapperRef} dangerouslySetInnerHTML={{ __html: svgContent }} />
      </ZoomPanContainer>

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
