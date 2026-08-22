import { useAtomValue } from "jotai";
import { chat2MetricsAtom } from "../store/LLMChat2Store";

interface ContextUsageGaugeProps {
  className?: string;
}

export function ContextUsageGauge({ className = "" }: ContextUsageGaugeProps) {
  const metrics = useAtomValue(chat2MetricsAtom);

  const percent = metrics ? metrics.percentConsumed : 0;
  const total = metrics ? metrics.totalTokens : 0;
  const numCtx = metrics ? metrics.numCtx : 16384;
  const remaining = metrics ? metrics.remainingTokens : 16384;
  const ctxK = (numCtx / 1024).toFixed(1);

  return (
    <div
      className={`flex items-center justify-between px-4 py-1.5 bg-muted/30 border-b border-border/40 text-[10px] text-muted-foreground shrink-0 select-none ${className}`}
      title={
        metrics
          ? `Input Tokens: ${metrics.promptTokens.toLocaleString()} | Output Tokens: ${metrics.completionTokens.toLocaleString()}`
          : "Context window usage (Ollama 16.4k context limit)"
      }
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-medium text-foreground/80">Context:</span>
        <span className="font-mono font-semibold text-sky-400">
          {percent}% of {ctxK}k
        </span>
        <span className="text-muted-foreground/70 text-[9px] truncate">
          ({total.toLocaleString()} / {numCtx.toLocaleString()} tokens)
        </span>
      </div>

      <div className="flex items-center gap-2 font-mono shrink-0">
        <span className="text-emerald-400 font-medium">
          {remaining.toLocaleString()} left
        </span>
        <div className="w-14 h-1.5 bg-muted/60 rounded-full overflow-hidden border border-border/40">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              percent > 80
                ? "bg-rose-500"
                : percent > 50
                ? "bg-amber-500"
                : "bg-sky-500"
            }`}
            style={{ width: `${Math.min(100, Math.max(percent > 0 ? 2 : 0, percent))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
