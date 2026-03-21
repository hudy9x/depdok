import { X, ArrowRightLeft } from 'lucide-react';
import * as Diff from "diff";
import { formatBlock } from "@/lib/monaco-actions/format-formatter";
import { useAtom } from "jotai";
import { diffModeAtom, DiffMode } from "./DiffStore";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FormatBlockType } from "@/lib/format-parser";

interface DiffViewerProps {
  sourceContent: string;
  targetContent: string;
  formatType: FormatBlockType;
  onClose?: () => void;
  title?: string;
}

export function DiffViewer({ sourceContent, targetContent, formatType, onClose, title = "Diff Comparison" }: DiffViewerProps) {
  const [diffMode, setDiffMode] = useAtom(diffModeAtom);

  let s = sourceContent;
  let t = targetContent;
  try {
    if (s.trim()) s = formatBlock(formatType, s);
    if (t.trim()) t = formatBlock(formatType, t);
  } catch {
    // Fall back to raw content if formatting fails
  }

  const diffResult = diffMode === 'words'
    ? Diff.diffWords(s, t)
    : diffMode === 'chars'
      ? Diff.diffChars(s, t)
      : Diff.diffLines(s, t);

  const isIdentical = diffResult.length === 1 && !diffResult[0].added && !diffResult[0].removed;

  return (
    <div className="flex flex-col w-[500px] max-w-[80vw] bg-card border border-border rounded-xl shadow-xl overflow-hidden pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <ArrowRightLeft className="w-3.5 h-3.5" />
          {title}
        </div>
        <div className="flex items-center gap-3">
          <ToggleGroup
            type="single"
            value={diffMode}
            onValueChange={(val) => {
              if (val) setDiffMode(val as DiffMode);
            }}
            className="bg-background border border-border rounded-md p-0.5"
          >
            <ToggleGroupItem value="lines" className="h-6 px-2 text-[10px] rounded hover:bg-muted">Lines</ToggleGroupItem>
            <ToggleGroupItem value="words" className="h-6 px-2 text-[10px] rounded hover:bg-muted">Words</ToggleGroupItem>
            <ToggleGroupItem value="chars" className="h-6 px-2 text-[10px] rounded hover:bg-muted">Chars</ToggleGroupItem>
          </ToggleGroup>
          {onClose && (
            <button
              className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-red-500/20 hover:text-red-500 transition-colors text-muted-foreground"
              onClick={onClose}
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className="w-full h-[300px] bg-background/50 relative" onWheel={(e) => e.stopPropagation()}>
        {isIdentical ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground p-4 text-center">
            The contents are identical.
          </div>
        ) : (
          <div className="w-full h-full">
            <ScrollArea className="w-full h-full bg-background overflow-hidden">
              <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-words p-3">
                {diffResult.map((part, index) => {
                  const bg = part.added
                    ? "bg-emerald-500/10 !text-emerald-600 dark:text-emerald-400"
                    : part.removed
                      ? "bg-rose-500/10 !text-rose-600 dark:text-rose-400"
                      : "text-muted-foreground";

                  if (diffMode === 'lines') {
                    const prefix = part.added ? "+ " : part.removed ? "- " : "  ";
                    const lines = part.value.split('\n');
                    if (lines[lines.length - 1] === '') lines.pop();

                    return (
                      <span key={index} className={`block w-full ${bg}`}>
                        {lines.map((line, i) => (
                          <span key={i} className="block px-1.5">{prefix}{line}</span>
                        ))}
                      </span>
                    );
                  }

                  // For words and chars, render inline
                  return (
                    <span key={index} className={bg}>
                      {part.value}
                    </span>
                  );
                })}
              </pre>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
