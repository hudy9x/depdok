import { useState, useEffect, useRef, useCallback } from "react";
import { encode } from "plantuml-encoder";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";
import { useTheme } from "next-themes";
import { useAtomValue, useSetAtom } from "jotai";
import { ArrowUpRight, Pencil, Trash2, Check, X, Users, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { ZoomPanContainer } from "@/components/ZoomPanContainer";
import { plantUmlServerUrlAtom } from "@/stores/SettingsStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getMessageLines,
  updateParticipantName,
  insertParticipantAfter,
  moveParticipant,
  getAllParticipantLineNumbers,
  findParticipantDefinition,
} from "./plantuml-parser";
import { plantUMLJumpAtom } from "./store";

interface PlantUMLPreviewProps {
  content: string;
  onContentChange?: (newContent: string) => void;
}

type PopoverMode =
  | "message-actions"
  | "edit-label"
  | "edit-participants"
  | "new-message"
  | "confirm-delete"
  | "participant-actions"
  | "edit-participant-name"
  | "new-participant";

interface PopoverState {
  open: boolean;
  x: number;
  y: number;
  mode: PopoverMode;
  // message fields
  lineNumber: number;
  sourceLine: string;
  // participant fields
  participantIdentifier: string;
  participantDisplayName: string;
  canMoveLeft: boolean;
  canMoveRight: boolean;
}

const POPOVER_CLOSED: PopoverState = {
  open: false, x: 0, y: 0, mode: "message-actions",
  lineNumber: 0, sourceLine: "",
  participantIdentifier: "", participantDisplayName: "",
  canMoveLeft: false, canMoveRight: false,
};

// ── Message line helpers ──────────────────────────────────────────────────────

const extractParticipants = (l: string) => { const i = l.indexOf(":"); return i !== -1 ? l.slice(0, i).trim() : l.trim(); };
const extractLabel = (l: string) => { const i = l.indexOf(":"); return i !== -1 ? l.slice(i + 1).trim() : l.trim(); };
const replaceLabel = (l: string, v: string) => { const i = l.indexOf(":"); return i !== -1 ? l.slice(0, i + 1) + " " + v : l; };
const replaceParticipants = (l: string, v: string) => { const i = l.indexOf(":"); return i !== -1 ? v + " :" + l.slice(i + 1) : v; };

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
        console.error("Error fetching SVG:", error);
        toast.error("Failed to generate UML diagram.");
      } finally {
        setLoading(false);
      }
    };
    fetchDiagram();
  }, [debouncedContent, resolvedTheme, plantUmlServerUrl]);

  // ── Message line index ───────────────────────────────────────────────────────

  const messageLines = useRef<number[]>([]);
  useEffect(() => { messageLines.current = getMessageLines(content); }, [content]);

  // ── Click handlers for .message ──────────────────────────────────────────────

  useEffect(() => {
    if (!svgWrapperRef.current || !svgContent) return;
    const raf = requestAnimationFrame(() => {
      const wrapper = svgWrapperRef.current;
      if (!wrapper) return;
      const cleanups: (() => void)[] = [];

      wrapper.querySelectorAll<SVGGElement>(".message").forEach((el, idx) => {
        const handler = (e: MouseEvent) => {
          e.stopPropagation();
          const lineNumber = messageLines.current[idx];
          if (!lineNumber) return;
          const sourceLine = content.split("\n")[lineNumber - 1] ?? "";
          const rect = containerRef.current?.getBoundingClientRect();
          setPopover({
            open: true,
            x: rect ? e.clientX - rect.left : e.clientX,
            y: rect ? e.clientY - rect.top : e.clientY,
            mode: "message-actions",
            lineNumber, sourceLine,
            participantIdentifier: "", participantDisplayName: "",
            canMoveLeft: false, canMoveRight: false,
          });
        };
        el.style.cursor = "pointer";
        el.addEventListener("click", handler);
        cleanups.push(() => el.removeEventListener("click", handler));
      });
      return () => cleanups.forEach((fn) => fn());
    });
    return () => cancelAnimationFrame(raf);
  }, [svgContent, content]);

  // ── Click handlers for .participant ──────────────────────────────────────────

  useEffect(() => {
    if (!svgWrapperRef.current || !svgContent) return;
    const raf = requestAnimationFrame(() => {
      const wrapper = svgWrapperRef.current;
      if (!wrapper) return;
      const cleanups: (() => void)[] = [];
      const seen = new Set<string>();

      // Collect SVG participant order for move boundary checks
      const svgParticipants: string[] = [];
      wrapper.querySelectorAll<SVGGElement>(".participant").forEach((el) => {
        const id = el.getAttribute("data-qualified-name") ?? "";
        if (id && !svgParticipants.includes(id)) svgParticipants.push(id);
      });

      wrapper.querySelectorAll<SVGGElement>(".participant").forEach((el) => {
        const identifier = el.getAttribute("data-qualified-name") ?? "";
        if (!identifier || seen.has(identifier)) return;
        seen.add(identifier);

        const handler = (e: MouseEvent) => {
          e.stopPropagation();
          const displayName = el.querySelector("text")?.textContent?.trim() ?? identifier;
          const rect = containerRef.current?.getBoundingClientRect();

          // Determine move boundaries using source definition order
          const allLines = getAllParticipantLineNumbers(content);
          const myDef = findParticipantDefinition(content, identifier);
          const myPos = myDef ? allLines.indexOf(myDef.lineNumber) : -1;

          setPopover({
            open: true,
            x: rect ? e.clientX - rect.left : e.clientX,
            y: rect ? e.clientY - rect.top : e.clientY,
            mode: "participant-actions",
            lineNumber: 0, sourceLine: "",
            participantIdentifier: identifier,
            participantDisplayName: displayName,
            canMoveLeft: myPos > 0,
            canMoveRight: myPos !== -1 && myPos < allLines.length - 1,
          });
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

  const applyLineEdit = useCallback((transform: (l: string) => string) => {
    if (!onContentChange || !popover.lineNumber) return;
    const lines = content.split("\n");
    lines[popover.lineNumber - 1] = transform(lines[popover.lineNumber - 1]);
    onContentChange(lines.join("\n"));
    setPopover(POPOVER_CLOSED);
  }, [content, onContentChange, popover.lineNumber]);

  const handleLabelConfirm = useCallback(() => applyLineEdit((l) => replaceLabel(l, inputValue.trim() || extractLabel(l))), [applyLineEdit, inputValue]);
  const handleParticipantsConfirm = useCallback(() => applyLineEdit((l) => replaceParticipants(l, inputValue.trim() || extractParticipants(l))), [applyLineEdit, inputValue]);

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

  const handleParticipantNameConfirm = useCallback(() => {
    if (!onContentChange || !popover.participantIdentifier || !inputValue.trim()) return;
    onContentChange(updateParticipantName(content, popover.participantIdentifier, inputValue.trim()));
    setPopover(POPOVER_CLOSED);
  }, [content, inputValue, onContentChange, popover.participantIdentifier]);

  const handleNewParticipantConfirm = useCallback(() => {
    if (!onContentChange || !inputValue.trim()) return;
    onContentChange(insertParticipantAfter(content, popover.participantIdentifier, inputValue.trim()));
    setPopover(POPOVER_CLOSED);
  }, [content, inputValue, onContentChange, popover.participantIdentifier]);

  const handleMoveParticipant = useCallback((direction: 'up' | 'down') => {
    if (!onContentChange || !popover.participantIdentifier) return;
    onContentChange(moveParticipant(content, popover.participantIdentifier, direction));
    setPopover(POPOVER_CLOSED);
  }, [content, onContentChange, popover.participantIdentifier]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, onConfirm: () => void) => {
      if (e.key === "Enter") onConfirm();
      if (e.key === "Escape") setPopover(POPOVER_CLOSED);
    }, []
  );

  const handleContainerClick = useCallback(() => setPopover(POPOVER_CLOSED), []);

  // ── Popover UI ───────────────────────────────────────────────────────────────

  const inlineInput = (placeholder: string, onConfirm: () => void) => (
    <div className="flex items-center gap-1">
      <Input
        autoFocus
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => handleKeyDown(e, onConfirm)}
        className="h-7 text-xs w-56"
        placeholder={placeholder}
      />
      <Button variant="ghost" size="icon" className="h-7 w-7 text-green-500 hover:text-green-400" onClick={onConfirm}>
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPopover(POPOVER_CLOSED)}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  const renderPopoverContent = () => {
    switch (popover.mode) {
      case "edit-label":
        return inlineInput("Message label…", handleLabelConfirm);

      case "edit-participants":
        return inlineInput("e.g. Alice -> Bob", handleParticipantsConfirm);

      case "new-message":
        return inlineInput("e.g. Alice -> Bob: Hello", handleNewMessageConfirm);

      case "confirm-delete":
        return (
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Delete message?</span>
            <Button variant="destructive" size="sm" className="h-6 px-2 text-xs" onClick={handleDeleteConfirm}>Yes</Button>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setPopover(POPOVER_CLOSED)}>No</Button>
          </div>
        );

      case "participant-actions":
        return (
          <>
            {/* Move left (up in source) */}
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              title="Move left" disabled={!popover.canMoveLeft}
              onClick={() => handleMoveParticipant('up')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Edit display name */}
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              title="Edit participant name"
              onClick={() => openMode("edit-participant-name", popover.participantDisplayName)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>

            {/* Create new participant after this one */}
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              title="Add participant after this one"
              onClick={() => openMode("new-participant", "")}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>

            {/* Move right (down in source) */}
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              title="Move right" disabled={!popover.canMoveRight}
              onClick={() => handleMoveParticipant('down')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        );

      case "edit-participant-name":
        return inlineInput(
          `Display name for "${popover.participantIdentifier}"…`,
          handleParticipantNameConfirm,
        );

      case "new-participant":
        return inlineInput(
          `participant "Name" as alias`,
          handleNewParticipantConfirm,
        );

      default: // message-actions
        return (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Jump to line" onClick={handleJump}>
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit message label"
              onClick={() => openMode("edit-label", extractLabel(popover.sourceLine))}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit participants & arrow"
              onClick={() => openMode("edit-participants", extractParticipants(popover.sourceLine))}>
              <Users className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Add message after this one"
              onClick={() => openMode("new-message", "")}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
              title="Delete message"
              onClick={() => setPopover((p) => ({ ...p, mode: "confirm-delete" }))}>
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
