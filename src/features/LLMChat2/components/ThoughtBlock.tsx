import React, { useState } from "react";
import { Lightbulb, ChevronRight } from "lucide-react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";

export interface ThoughtBlockProps {
  content: string;
  durationSeconds?: number;
  isStreaming?: boolean;
}

export const ThoughtBlock: React.FC<ThoughtBlockProps> = ({
  content,
  durationSeconds,
  isStreaming = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!content.trim() && !isStreaming) {
    return null;
  }

  const label = durationSeconds && durationSeconds > 0
    ? `Thought for ${durationSeconds.toFixed(1)}s`
    : "Thought";

  return (
    <div className="w-full my-1.5 rounded-xl border border-border/40 bg-muted/20 overflow-hidden transition-all select-text">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground w-full select-none cursor-pointer transition-colors bg-muted/10 hover:bg-muted/30"
      >
        <Lightbulb className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
        <span className="font-medium text-xs text-muted-foreground">
          {label}
        </span>
        {isStreaming && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse ml-1" />
        )}
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 ml-auto text-muted-foreground/70 transition-transform duration-200 shrink-0",
            isOpen && "rotate-90"
          )}
        />
      </button>

      {isOpen && (
        <div className="px-3.5 py-2.5 text-[11px] text-muted-foreground/90 border-t border-border/20 bg-background/50 leading-relaxed font-sans select-text">
          <Streamdown animated caret="block">
            {content}
          </Streamdown>
        </div>
      )}
    </div>
  );
};
