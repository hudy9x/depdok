import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as Diff from "diff";
import { formatBlock } from "@/lib/monaco-actions/format-formatter";
import { FormatBlockType } from "@/lib/format-parser";
import { useAtom } from "jotai";
import { diffModeAtom, DiffMode } from "./DiffStore";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface DiffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  sourceContent: string;
  targetContent: string;
  formatType: FormatBlockType;
}

export function DiffDialog({ open, onOpenChange, title, sourceContent, targetContent, formatType }: DiffDialogProps) {
  let s = sourceContent || "";
  let t = targetContent || "";
  try {
    if (s.trim()) s = formatBlock(formatType, s);
    if (t.trim()) t = formatBlock(formatType, t);
  } catch {
    // Fall back to raw content if formatting fails
  }

  const [diffMode, setDiffMode] = useAtom(diffModeAtom);

  const diffResult = diffMode === 'words'
    ? Diff.diffWords(s, t)
    : diffMode === 'chars'
      ? Diff.diffChars(s, t)
      : Diff.diffLines(s, t);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0">
          <DialogTitle>{title}</DialogTitle>
          <ToggleGroup
            type="single"
            value={diffMode}
            onValueChange={(val) => {
              if (val) setDiffMode(val as DiffMode);
            }}
            className="border border-border rounded-md p-1"
          >
            <ToggleGroupItem value="lines" className="h-6 px-2 text-xs rounded-md">Lines</ToggleGroupItem>
            <ToggleGroupItem value="words" className="h-6 px-2 text-xs rounded-md">Words</ToggleGroupItem>
            <ToggleGroupItem value="chars" className="h-6 px-2 text-xs rounded-md">Chars</ToggleGroupItem>
          </ToggleGroup>
        </DialogHeader>
        <ScrollArea className="flex-1 bg-muted/30 rounded-md border border-border p-4 mt-2">
          <pre className="text-sm font-mono leading-relaxed whitespace-pre-wrap">
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
                      <span key={i} className="block px-2">{prefix}{line}</span>
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
      </DialogContent>
    </Dialog>
  );
}
