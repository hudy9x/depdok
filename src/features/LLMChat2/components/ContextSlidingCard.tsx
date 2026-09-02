import React, { useState } from "react";
import { Layers, ChevronDown, ChevronRight, Info, Zap } from "lucide-react";
import { SlidingWindowInfo } from "../store/LLMChat2Store";

interface ContextSlidingCardProps {
  info: SlidingWindowInfo;
}

export const ContextSlidingCard: React.FC<ContextSlidingCardProps> = ({ info }) => {
  const [isOpen, setIsOpen] = useState(false);

  const ctxK = (info.numCtx / 1024).toFixed(1);
  const folded = info.foldedTools ?? 0;
  const pruned = info.prunedTurns;

  const turnsLabel = pruned === 1 ? "1 older turn" : `${pruned} older turns`;
  const toolsLabel = folded === 1 ? "1 tool payload" : `${folded} tool payloads`;

  let title = "Context memory adjusted";
  let subtitle = "";
  let badge = "";

  if (pruned > 0 && folded > 0) {
    title = "Context compacted & adjusted";
    subtitle = `Folded ${toolsLabel} and pruned ${turnsLabel} to stay within ${ctxK}k limit`;
    badge = `-${folded} tools · -${pruned} turns`;
  } else if (folded > 0) {
    title = "Tool outputs compacted";
    subtitle = `Folded ${toolsLabel} from past turns to save memory headroom`;
    badge = `-${folded} tool outputs`;
  } else {
    title = "Sliding window adjusted";
    subtitle = `Pruned ${turnsLabel} to stay within ${ctxK}k context limit`;
    badge = `-${pruned} turns`;
  }

  return (
    <div className="my-1.5 rounded-xl border border-amber-500/30 bg-amber-500/5 shadow-xs overflow-hidden text-xs transition-all select-none">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-amber-500/10 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-md bg-amber-500/10 text-amber-500 shrink-0">
            {folded > 0 ? <Zap className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-[11px] text-foreground/90 truncate">
              {title}
            </span>
            <span className="text-[10px] text-muted-foreground truncate">
              {subtitle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
            {badge}
          </span>
          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </div>
      </button>

      {isOpen && (
        <div className="px-3 pb-2.5 pt-1.5 space-y-1.5 border-t border-amber-500/20 bg-background/50 text-[11px] text-muted-foreground leading-relaxed">
          <div className="flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>
                To maintain low CPU prefill latency and stay safely under the{" "}
                <span className="font-mono font-semibold text-foreground">{ctxK}k</span> context limit:
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-[10.5px]">
                {folded > 0 && (
                  <li>
                    Folded <span className="font-semibold text-foreground">{toolsLabel}</span> into compact summaries.
                  </li>
                )}
                {pruned > 0 && (
                  <li>
                    Archived <span className="font-semibold text-foreground">{turnsLabel}</span> while keeping the newest{" "}
                    <span className="font-semibold text-foreground">{info.retainedTurns}</span> turns, MCP tools, and system prompt intact.
                  </li>
                )}
              </ul>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/80 pl-5">
            Tip: You can toggle Auto Compact or increase the context window slider in the bottom toolbar anytime.
          </p>
        </div>
      )}
    </div>
  );
};
