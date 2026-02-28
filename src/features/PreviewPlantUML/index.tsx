import { useState, useEffect, useRef, useCallback } from "react";
import { encode } from "plantuml-encoder";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";
import { useTheme } from "next-themes";
import { useAtomValue, useSetAtom } from "jotai";
import { ArrowUpRight, Pencil, Trash2, Check, X, Users, Plus, ChevronLeft, ChevronRight, MessageSquare, Split, AlignLeft, AlignCenter, AlignRight, Repeat } from "lucide-react";

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
  getNotes,
  getGroupLabels,
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
  | "new-message-note"
  | "confirm-delete"
  | "participant-actions"
  | "edit-participant-name"
  | "new-participant"
  | "note-actions"
  | "edit-note"
  | "edit-note-over"
  | "edit-group-label"
  | "group-actions";

interface PopoverState {
  open: boolean;
  x: number;
  y: number;
  mode: PopoverMode;
  // message fields
  lineNumber: number;
  sourceLine: string;
  // note fields
  noteStartLine: number;
  noteEndLine: number;
  noteTextBlock: string;
  noteDirection: "left" | "right" | "over" | "unknown";
  // participant fields
  participantIdentifier: string;
  participantDisplayName: string;
  canMoveLeft: boolean;
  canMoveRight: boolean;
}

const POPOVER_CLOSED: PopoverState = {
  open: false, x: 0, y: 0, mode: "message-actions",
  lineNumber: 0, sourceLine: "",
  noteStartLine: 0, noteEndLine: 0, noteTextBlock: "", noteDirection: "unknown",
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

  // ── Selected element highlight ───────────────────────────────────────────────
  const clickedEl = useRef<Element | null>(null);
  const clearSelection = useCallback(() => {
    if (clickedEl.current) {
      clickedEl.current.classList.remove("plantuml-selected");
      clickedEl.current = null;
    }
  }, []);
  const selectElement = useCallback((el: Element) => {
    clearSelection();
    el.classList.add("plantuml-selected");
    clickedEl.current = el;
  }, [clearSelection]);

  const closePopover = useCallback(() => {
    clearSelection();
    setPopover(POPOVER_CLOSED);
  }, [clearSelection]);

  // ── Fetch SVG ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!debouncedContent) { setSvgContent(""); return; }
    const fetchDiagram = async () => {
      setLoading(true);
      try {
        const encoded = encode(debouncedContent);
        const isDark = resolvedTheme === "dark";
        const url = plantUmlServerUrl
          ? `${plantUmlServerUrl} /svg/${encoded} `
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
          selectElement(el.querySelector("text") ?? el);
          setPopover({
            open: true,
            x: rect ? e.clientX - rect.left : e.clientX,
            y: rect ? e.clientY - rect.top : e.clientY,
            mode: "message-actions",
            lineNumber, sourceLine,
            noteStartLine: 0, noteEndLine: 0, noteTextBlock: "", noteDirection: "unknown",
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

          selectElement(el);
          setPopover({
            open: true,
            x: rect ? e.clientX - rect.left : e.clientX,
            y: rect ? e.clientY - rect.top : e.clientY,
            mode: "participant-actions",
            lineNumber: 0, sourceLine: "",
            noteStartLine: 0, noteEndLine: 0, noteTextBlock: "", noteDirection: "unknown",
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

  // ── Click handlers for Notes ─────────────────────────────────────────────────

  const parsedNotes = useRef(getNotes(content));
  useEffect(() => { parsedNotes.current = getNotes(content); }, [content]);

  useEffect(() => {
    if (!svgWrapperRef.current || !svgContent) return;
    const raf = requestAnimationFrame(() => {
      const wrapper = svgWrapperRef.current;
      if (!wrapper) return;
      const cleanups: (() => void)[] = [];

      // Heuristic: finding note paths by looking for <text> elements that match note backgrounds
      wrapper.querySelectorAll<SVGTextElement>("text").forEach((textEl) => {
        const textContent = textEl.textContent?.trim();
        if (!textContent) return;

        // See if this text matches any parsed note
        const matchingNote = parsedNotes.current.find(n => n.textBlock.includes(textContent) || textContent.includes(n.textBlock.split('\n')[0].trim()));
        if (!matchingNote) return;

        // The shape behind the text is usually the previous sibling (a path or rect or polygon)
        // Climb up if needed. In PlantUML sequences, notes have a #FEFFDD or #EEEEEE path/polygon before text
        let shapeEl: Element | null = textEl.previousElementSibling;
        while (shapeEl && shapeEl.tagName !== "path" && shapeEl.tagName !== "polygon" && shapeEl.tagName !== "rect") {
          shapeEl = shapeEl.previousElementSibling;
        }


        const handler = (e: MouseEvent) => {
          e.stopPropagation();
          const rect = containerRef.current?.getBoundingClientRect();
          selectElement(textEl);
          setPopover({
            open: true,
            x: rect ? e.clientX - rect.left : e.clientX,
            y: rect ? e.clientY - rect.top : e.clientY,
            mode: "note-actions",
            lineNumber: 0, sourceLine: "",
            noteStartLine: matchingNote.startLine,
            noteEndLine: matchingNote.endLine,
            noteTextBlock: matchingNote.textBlock,
            noteDirection: matchingNote.direction,
            participantIdentifier: "", participantDisplayName: "",
            canMoveLeft: false, canMoveRight: false,
          });
        };

        const attachTo = (el: Element | null) => {
          if (!el) return;
          (el as HTMLElement).style.cursor = "pointer";
          el.addEventListener("click", handler as EventListener);
          cleanups.push(() => el.removeEventListener("click", handler as EventListener));
        };

        attachTo(textEl);
        if (shapeEl) attachTo(shapeEl);
      });

      // ── Click handlers for Alt/Else Labels ──────────────────────────────────────
      const groupLabels = getGroupLabels(content);
      const alts = groupLabels.filter(l => l.type === "alt");
      let altIdx = 0;

      wrapper.querySelectorAll<SVGTextElement>("text").forEach((textEl) => {
        const textContent = textEl.textContent?.trim();
        if (!textContent) return;

        let matchingLabel = undefined;
        let elementsToAttach: Element[] = [textEl];

        if (textContent === "alt" && altIdx < alts.length) {
          matchingLabel = alts[altIdx];
          altIdx++;

          // Attempt to find the dog-ear path to make it clickable
          let prev = textEl.previousElementSibling;
          while (prev && prev.tagName !== "path") {
            prev = prev.previousElementSibling;
          }
          if (prev && prev.tagName === "path") {
            elementsToAttach.push(prev);
          }
        } else {
          // Strip bracket prefixes common in PlantUML `[label]` for conditions
          const cleanContent = textContent.replace(/^\[/, "").replace(/\]$/, "");
          matchingLabel = groupLabels.find(l => l.text === cleanContent || l.text === textContent);
        }

        if (!matchingLabel) return;

        const handler = (e: MouseEvent) => {
          e.stopPropagation();
          const rect = containerRef.current?.getBoundingClientRect();
          selectElement(textEl);
          setPopover({
            open: true,
            x: rect ? e.clientX - rect.left : e.clientX,
            y: rect ? e.clientY - rect.top : e.clientY,
            mode: "group-actions",
            lineNumber: matchingLabel!.lineNumber,
            sourceLine: matchingLabel!.text,
            noteStartLine: 0, noteEndLine: 0, noteTextBlock: "", noteDirection: "unknown",
            participantIdentifier: "", participantDisplayName: "",
            canMoveLeft: false, canMoveRight: false,
          });
        };

        elementsToAttach.forEach((el) => {
          (el as HTMLElement).style.cursor = "pointer";
          el.addEventListener("click", handler as EventListener);
          cleanups.push(() => el.removeEventListener("click", handler as EventListener));
        });
      });

      return () => cleanups.forEach((fn) => fn());
    });
    return () => cancelAnimationFrame(raf);
  }, [svgContent, content]);

  // ── Action handlers ──────────────────────────────────────────────────────────

  const handleJump = useCallback(() => {
    if (!popover.lineNumber) return;
    setJump({ lineNumber: popover.lineNumber });
    closePopover();
  }, [popover.lineNumber, setJump, closePopover]);

  const openMode = useCallback((mode: PopoverMode, prefill: string) => {
    setInputValue(prefill);
    setPopover((p) => ({ ...p, mode }));
  }, []);

  const applyLineEdit = useCallback((transform: (l: string) => string) => {
    if (!onContentChange || !popover.lineNumber) return;
    const lines = content.split("\n");
    lines[popover.lineNumber - 1] = transform(lines[popover.lineNumber - 1]);
    onContentChange(lines.join("\n"));
    closePopover();
  }, [content, onContentChange, popover.lineNumber, closePopover]);

  const handleLabelConfirm = useCallback(() => applyLineEdit((l) => replaceLabel(l, inputValue.trim() || extractLabel(l))), [applyLineEdit, inputValue]);
  const handleParticipantsConfirm = useCallback(() => applyLineEdit((l) => replaceParticipants(l, inputValue.trim() || extractParticipants(l))), [applyLineEdit, inputValue]);

  const handleNewMessageConfirm = useCallback(() => {
    if (!onContentChange || !inputValue.trim()) return;
    const lines = content.split("\n");
    const insertLine = popover.lineNumber > 0 ? popover.lineNumber : popover.noteEndLine;
    if (insertLine > 0) {
      lines.splice(insertLine, 0, inputValue.trim());
      onContentChange(lines.join("\n"));
    }
    closePopover();
  }, [content, inputValue, onContentChange, popover.lineNumber, popover.noteEndLine, closePopover]);

  const handleDeleteConfirm = useCallback(() => {
    if (!onContentChange) return;
    const lines = content.split("\n");
    if (popover.noteStartLine > 0) {
      // Deleting a note block
      lines.splice(popover.noteStartLine - 1, popover.noteEndLine - popover.noteStartLine + 1);
    } else if (popover.lineNumber > 0) {
      // Deleting a discrete line
      lines.splice(popover.lineNumber - 1, 1);
    } else return;
    onContentChange(lines.join("\n"));
    closePopover();
  }, [content, onContentChange, popover.lineNumber, popover.noteStartLine, popover.noteEndLine, closePopover]);

  const handleParticipantNameConfirm = useCallback(() => {
    if (!onContentChange || !popover.participantIdentifier || !inputValue.trim()) return;
    onContentChange(updateParticipantName(content, popover.participantIdentifier, inputValue.trim()));
    closePopover();
  }, [content, inputValue, onContentChange, popover.participantIdentifier, closePopover]);

  const handleNewParticipantConfirm = useCallback(() => {
    if (!onContentChange || !inputValue.trim()) return;
    onContentChange(insertParticipantAfter(content, popover.participantIdentifier, inputValue.trim()));
    closePopover();
  }, [content, inputValue, onContentChange, popover.participantIdentifier, closePopover]);

  const handleMoveParticipant = useCallback((direction: 'up' | 'down') => {
    if (!onContentChange || !popover.participantIdentifier) return;
    onContentChange(moveParticipant(content, popover.participantIdentifier, direction));
    closePopover();
  }, [content, onContentChange, popover.participantIdentifier, closePopover]);

  const handleNewNoteConfirm = useCallback(() => {
    if (!onContentChange || !popover.lineNumber || !inputValue.trim()) return;
    const lines = content.split("\n");
    const noteContent = inputValue.includes("\n")
      ? `note right\n${inputValue}\nend note`
      : `note right: ${inputValue}`;
    lines.splice(popover.lineNumber, 0, noteContent);
    onContentChange(lines.join("\n"));
    closePopover();
  }, [content, inputValue, onContentChange, popover.lineNumber, closePopover]);

  const handleEditNoteConfirm = useCallback(() => {
    if (!onContentChange || !popover.noteStartLine || !inputValue.trim()) return;
    const lines = content.split("\n");

    // Determine the existing tag style by scanning the start line
    const startLineStr = lines[popover.noteStartLine - 1];
    const match = startLineStr.match(/^\s*(note\s+.*?)(?::|$)/i);
    const tag = match ? match[1] : `note right`;

    const noteContent = inputValue.includes("\n")
      ? `${tag}\n${inputValue}\nend note`
      : `${tag}: ${inputValue}`;

    // Remove the old block and insert the new one
    lines.splice(popover.noteStartLine - 1, popover.noteEndLine - popover.noteStartLine + 1, noteContent);

    onContentChange(lines.join("\n"));
    closePopover();
  }, [content, inputValue, onContentChange, popover.noteStartLine, popover.noteEndLine, closePopover]);

  const handleNoteDirectionChange = useCallback((newDirection: "left" | "right" | "over", target?: string) => {
    if (!onContentChange || !popover.noteStartLine) return;
    const lines = content.split("\n");
    const startLineStr = lines[popover.noteStartLine - 1];

    let newTag = `note ${newDirection}`;
    if (target) {
      newTag = `note over ${target}`;
    }

    const match = startLineStr.match(/^\s*(note\s+.*?)(?::|$)/i);
    if (match) {
      lines[popover.noteStartLine - 1] = startLineStr.replace(match[1], newTag);
    } else {
      // Fallback
      if (startLineStr.includes(':')) {
        lines[popover.noteStartLine - 1] = startLineStr.replace(/^.*?(\s*:)/, `${newTag}$1`);
      } else {
        lines[popover.noteStartLine - 1] = newTag;
      }
    }
    onContentChange(lines.join("\n"));
    closePopover();
  }, [content, onContentChange, popover.noteStartLine, closePopover]);

  const handleEditNoteOverConfirm = useCallback(() => {
    if (!inputValue.trim()) return;
    handleNoteDirectionChange("over" as any, inputValue.trim());
  }, [inputValue, handleNoteDirectionChange]);

  const handleEditGroupLabelConfirm = useCallback(() => {
    if (!onContentChange || !popover.lineNumber || !inputValue.trim()) return;
    const lines = content.split("\n");
    const source = lines[popover.lineNumber - 1];

    // Replace the text content while keeping the `alt` or `else` prefix.
    const match = source.match(/^(\s*(?:alt|else)\s*)(.*)$/i);
    if (match) {
      lines[popover.lineNumber - 1] = match[1] + (match[1].endsWith(' ') ? '' : ' ') + inputValue.trim();
      onContentChange(lines.join("\n"));
    }
    closePopover();
  }, [content, inputValue, onContentChange, popover.lineNumber, closePopover]);

  const handleAddAlt = useCallback(() => {
    if (!onContentChange || !popover.lineNumber) return;
    const lines = content.split("\n");
    const altBlock = [
      `alt If`,
      `  note across: Add condition here`,
      `else Else`,
      `  note across: Add condition here`,
      `end`
    ].join('\n');
    lines.splice(popover.lineNumber, 0, altBlock);
    onContentChange(lines.join("\n"));
    closePopover();
  }, [content, onContentChange, popover.lineNumber, closePopover]);

  const handleAddLoop = useCallback(() => {
    if (!onContentChange || !popover.lineNumber) return;
    const lines = content.split("\n");
    const loopBlock = [
      `loop 10 times`,
      `  note across: Add condition here`,
      `end`
    ].join('\n');
    lines.splice(popover.lineNumber, 0, loopBlock);
    onContentChange(lines.join("\n"));
    closePopover();
  }, [content, onContentChange, popover.lineNumber, closePopover]);

  const handleAppendElse = useCallback(() => {
    if (!onContentChange || !popover.lineNumber) return;
    const lines = content.split("\n");
    const elseBlock = [
      `else Else`,
      `  note across: Add condition here`
    ].join('\n');
    lines.splice(popover.lineNumber, 0, elseBlock);
    onContentChange(lines.join("\n"));
    closePopover();
  }, [content, onContentChange, popover.lineNumber, closePopover]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, onConfirm: () => void) => {
      // For textarea, require Ctrl/Cmd + Enter so regular Enter makes newlines
      if (e.key === "Enter") {
        if (e.currentTarget.tagName.toLowerCase() === "textarea") {
          if (e.ctrlKey || e.metaKey) onConfirm();
        } else {
          onConfirm();
        }
      }
      if (e.key === "Escape") closePopover();
    }, [closePopover]
  );

  const handleContainerClick = useCallback(() => {
    closePopover();
  }, [closePopover]);

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
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={closePopover}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  const multilineInput = (placeholder: string, onConfirm: () => void) => (
    <div className="flex flex-col gap-1 w-64">
      <textarea
        autoFocus
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => handleKeyDown(e, onConfirm)}
        className="text-xs p-2 min-h-[60px] resize-y rounded-md border border-input bg-transparent shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        placeholder={placeholder}
      />
      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
        <span>Cmd/Ctrl + Enter to confirm</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-green-500 hover:text-green-400" onClick={onConfirm}>
            <Check className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={closePopover}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );

  const tip = (label: string, child: React.ReactElement) => (
    <div className="relative group/tip">
      {child}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[11px] leading-none text-primary-foreground bg-primary rounded whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-[100]">
        {label}
      </span>
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

      case "new-message-note":
        return multilineInput("Note text...", handleNewNoteConfirm);

      case "edit-note":
        return multilineInput("Edit note (Cmd+Enter to save)...", handleEditNoteConfirm);

      case "note-actions":
        return (
          <>
            {tip("Add message after this note",
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openMode("new-message", "")}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}
            <div className="w-px h-4 bg-border mx-1" />
            {tip("Edit note",
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openMode("edit-note", popover.noteTextBlock)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {tip("Position left",
              <Button variant="ghost" size="icon" className={`h-7 w-7 ${popover.noteDirection === 'left' ? 'bg-muted' : ''}`}
                onClick={() => handleNoteDirectionChange("left")}>
                <AlignLeft className="h-3.5 w-3.5" />
              </Button>
            )}
            {tip("Position over (select participant)",
              <Button variant="ghost" size="icon" className={`h-7 w-7 text-center ${popover.noteDirection === 'over' ? 'bg-muted' : ''}`}
                onClick={() => openMode("edit-note-over", "")}>
                <AlignCenter className="h-3.5 w-3.5" />
              </Button>
            )}
            {tip("Position right",
              <Button variant="ghost" size="icon" className={`h-7 w-7 ${popover.noteDirection === 'right' ? 'bg-muted' : ''}`}
                onClick={() => handleNoteDirectionChange("right")}>
                <AlignRight className="h-3.5 w-3.5" />
              </Button>
            )}
            <div className="w-px h-4 bg-border mx-1" />
            {tip("Delete note",
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => setPopover((p) => ({ ...p, mode: "confirm-delete" }))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </>
        );

      case "edit-note-over":
        return inlineInput("Participant(s)...", handleEditNoteOverConfirm);

      case "group-actions":
        return (
          <>
            {tip("Add message after this line",
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openMode("new-message", "")}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}
            {popover.lineNumber > 0 && /^\s*alt\b/i.test(content.split('\n')[popover.lineNumber - 1]) && (
              <>
                <div className="w-px h-4 bg-border mx-1" />
                {tip("Append else branch",
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleAppendElse}>
                    <Split className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}
            <div className="w-px h-4 bg-border mx-1" />
            {tip("Edit condition label",
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => openMode("edit-group-label", popover.sourceLine)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            <div className="w-px h-4 bg-border mx-1" />
            {tip("Jump to source line",
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleJump}>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            )}
            <div className="w-px h-4 bg-border mx-1" />
            {tip("Delete condition",
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => setPopover((p) => ({ ...p, mode: "confirm-delete" }))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </>
        );

      case "edit-group-label":
        return inlineInput("Condition / Label...", handleEditGroupLabelConfirm);

      case "confirm-delete": {
        let deleteLabel = "message";
        if (popover.noteStartLine > 0) deleteLabel = "note";
        else if (/^\s*(alt|else|loop)\b/i.test(popover.sourceLine)) deleteLabel = "condition";
        return (
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Delete {deleteLabel}?</span>
            <Button variant="destructive" size="sm" className="h-6 px-2 text-xs" onClick={handleDeleteConfirm}>Yes</Button>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={closePopover}>No</Button>
          </div>
        );
      }

      case "participant-actions":
        return (
          <>
            {tip("Move participant left",
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                disabled={!popover.canMoveLeft}
                onClick={() => handleMoveParticipant('up')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            {tip("Edit display name",
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => openMode("edit-participant-name", popover.participantDisplayName)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {tip("Add participant after this one",
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => openMode("new-participant", "")}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}
            {tip("Move participant right",
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                disabled={!popover.canMoveRight}
                onClick={() => handleMoveParticipant('down')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
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
            {tip("Jump to source line",
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleJump}>
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            )}
            {tip("Edit message label",
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => openMode("edit-label", extractLabel(popover.sourceLine))}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {tip("Edit participants & arrow",
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => openMode("edit-participants", extractParticipants(popover.sourceLine))}>
                <Users className="h-3.5 w-3.5" />
              </Button>
            )}
            {tip("Add message after this one",
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => openMode("new-message", "")}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}
            {tip("Add note after this message",
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => openMode("new-message-note", "")}>
                <MessageSquare className="h-3.5 w-3.5" />
              </Button>
            )}
            {tip("Add alt/else block after this message",
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleAddAlt}>
                <Split className="h-3.5 w-3.5" />
              </Button>
            )}
            {tip("Add loop block after this message",
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleAddLoop}>
                <Repeat className="h-3.5 w-3.5" />
              </Button>
            )}
            {tip("Delete message",
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => setPopover((p) => ({ ...p, mode: "confirm-delete" }))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
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
      {/* CSS for the clicked-element highlight */}
      <style>{`.plantuml-selected { fill: red !important; }`}</style>

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
