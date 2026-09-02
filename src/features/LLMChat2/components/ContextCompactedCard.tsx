import React, { useState } from "react";
import { Sparkles, ChevronDown, ChevronRight, Check } from "lucide-react";
import { CompactedInfo } from "../store/LLMChat2Store";

interface ContextCompactedCardProps {
  info: CompactedInfo;
}

export const ContextCompactedCard: React.FC<ContextCompactedCardProps> = ({ info }) => {
  const [isOpen, setIsOpen] = useState(true);

  const savedTokens = Math.max(0, info.estimatedTokensBefore - info.estimatedTokensAfter);
  const savedPercent =
    info.estimatedTokensBefore > 0
      ? Math.round((savedTokens / info.estimatedTokensBefore) * 100)
      : 0;

  const turnsLabel = info.originalTurns === 1 ? "1 turn" : `${info.originalTurns} turns`;

  return (
    <div className="my-2 rounded-xl border border-sky-500/30 bg-sky-500/5 shadow-xs overflow-hidden text-xs transition-all select-none">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-sky-500/10 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-md bg-sky-500/15 text-sky-500 shrink-0">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-[11px] text-foreground/90 truncate">
              Conversation Compacted
            </span>
            <span className="text-[10px] text-muted-foreground truncate">
              Compressed {turnsLabel} into executive summary (~{savedPercent}% token savings)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium">
            Saved ~{savedTokens.toLocaleString()} tokens
          </span>
          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </div>
      </button>

      {isOpen && (
        <div className="px-3.5 pb-3 pt-2 space-y-2 border-t border-sky-500/20 bg-background/60 text-[11px] text-foreground/90 leading-relaxed font-sans select-text">
          <div className="flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-wider text-sky-500/90 font-semibold">
            <Check className="h-3 w-3" />
            <span>Retained Memory Context</span>
          </div>
          <div className="whitespace-pre-wrap rounded-lg p-2.5 bg-muted/30 border border-border/40 text-foreground/85 leading-relaxed">
            {info.summary}
          </div>
        </div>
      )}
    </div>
  );
};
