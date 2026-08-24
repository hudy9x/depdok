import { useAtom, useAtomValue } from "jotai";
import { SlidersHorizontal } from "lucide-react";
import { chat2MetricsAtom, chat2NumCtxAtom } from "../store/LLMChat2Store";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ContextUsageGaugeProps {
  className?: string;
}

const PRESETS = [
  { label: "8k", value: 8192 },
  { label: "16k", value: 16384 },
  { label: "32k", value: 32768 },
  { label: "64k", value: 65536 },
  { label: "128k", value: 131072 },
  { label: "256k", value: 262144 },
];

export function ContextUsageGauge({ className = "" }: ContextUsageGaugeProps) {
  const metrics = useAtomValue(chat2MetricsAtom);
  const [numCtx, setNumCtx] = useAtom(chat2NumCtxAtom);

  const activeLimit = metrics ? metrics.numCtx : numCtx;
  const percent = metrics ? metrics.percentConsumed : 0;
  const ctxK = (activeLimit / 1024).toFixed(1);

  return (
    <div
      className={`flex items-center justify-between px-2.5 py-1 text-[10px] text-muted-foreground select-none ${className}`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-medium text-foreground/80">Context:</span>
        <span className="font-mono font-semibold text-primary">
          {percent}% of {ctxK}k
        </span>
      </div>

      <div className="flex items-center gap-2 font-mono shrink-0">

        {/* Custom num_ctx Slider Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="p-1 -mr-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Configure context window size (num_ctx)"
            >
              <SlidersHorizontal className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            sideOffset={8}
            className="w-72 p-3.5 space-y-3 bg-popover/95 backdrop-blur-xl border border-border/60 shadow-xl rounded-xl"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Context Window</span>
              <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
                {numCtx.toLocaleString()}
              </span>
            </div>

            <div className="space-y-1.5">
              <Slider
                value={[numCtx]}
                min={2048}
                max={262144}
                step={2048}
                onValueChange={(val) => {
                  if (val[0]) setNumCtx(val[0]);
                }}
                className="py-1"
              />
              <div className="flex justify-between text-[9px] text-muted-foreground/80 font-mono">
                <span>2k</span>
                <span>64k</span>
                <span>128k</span>
                <span>256k</span>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[10px] text-muted-foreground shrink-0">Presets:</span>
              <div className="flex items-center gap-1 flex-wrap">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setNumCtx(preset.value)}
                    className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors cursor-pointer ${
                      numCtx === preset.value
                        ? "bg-primary text-primary-foreground font-medium shadow-xs"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground leading-relaxed pt-1 border-t border-border/40">
              Allocates Ollama context buffer. Higher values hold longer chats &amp; larger documents, but require more VRAM.
            </p>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
