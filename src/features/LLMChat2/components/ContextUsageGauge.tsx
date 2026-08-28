import { useAtom, useAtomValue } from "jotai";
import { SlidersHorizontal } from "lucide-react";
import { chat2MetricsAtom, chat2NumCtxAtom, chat2IsStatefulAtom } from "../store/LLMChat2Store";
import { McpStatusPopover } from "./McpStatusPopover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
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
  const [isStateful, setIsStateful] = useAtom(chat2IsStatefulAtom);

  const activeLimit = metrics ? metrics.numCtx : numCtx;
  const percent = metrics ? metrics.percentConsumed : 0;
  const ctxK = (activeLimit / 1024).toFixed(1);

  return (
    <div
      className={`chat2-context-gauge flex items-center justify-between px-2.5 py-1 text-[10px] text-muted-foreground select-none ${className}`}
    >
      <div className="chat2-context-gauge-left flex items-center gap-1.5 min-w-0">
        <span className="chat2-context-label font-medium text-foreground/80">Context:</span>
        <span className="chat2-context-value font-mono font-semibold text-primary">
          {percent}% of {ctxK}k
        </span>
      </div>

      <div className="chat2-context-gauge-right flex items-center gap-2 shrink-0">
        {/* Stateful / Stateless History Switch */}
        <div
          className="chat2-history-switch flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/50 border border-border/40 text-[9px]"
          title={
            isStateful
              ? "Stateful Mode (ON): Multi-turn conversation history is sent with each prompt."
              : "Stateless Mode (OFF): Each prompt is evaluated in complete isolation."
          }
        >
          <span
            className={`chat2-history-text font-sans font-medium select-none transition-colors ${
              isStateful ? "text-sky-500 font-semibold" : "text-muted-foreground"
            }`}
          >
            {isStateful ? "History ON" : "History OFF"}
          </span>
          <Switch
            checked={isStateful}
            onCheckedChange={setIsStateful}
            className="scale-75 origin-right cursor-pointer"
          />
        </div>

        {/* MCP Server Status Popover */}
        <McpStatusPopover />

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
