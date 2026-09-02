import { useEffect, useRef, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { SlidersHorizontal, Sparkles, Loader2 } from "lucide-react";
import {
  chat2MetricsAtom,
  chat2NumCtxAtom,
  chat2IsStatefulAtom,
  chat2AutoCompactAtom,
  chat2SlidingWindowAtom,
  chat2ShowClassifierAtom,
  isCompactingAtom,
} from "../store/LLMChat2Store";
import { McpStatusPopover } from "./McpStatusPopover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ContextUsageGaugeProps {
  className?: string;
  onCompactHistory?: () => void;
  messagesCount?: number;
}

const PRESETS = [
  { label: "8k", value: 8192 },
  { label: "16k", value: 16384 },
  { label: "32k", value: 32768 },
  { label: "64k", value: 65536 },
  { label: "128k", value: 131072 },
  { label: "256k", value: 262144 },
];

/**
 * Hook to smoothly animate numeric values over time with cubic ease-out.
 */
function useAnimatedNumber(target: number, durationMs = 500): number {
  const [current, setCurrent] = useState(target);
  const startValRef = useRef(target);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    startValRef.current = current;
    startTimeRef.current = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / durationMs, 1);
      // Ease out cubic
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const val = startValRef.current + (target - startValRef.current) * easedProgress;
      setCurrent(val);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => cancelAnimationFrame(animationFrameId);
  }, [target, durationMs]);

  return current;
}

export function ContextUsageGauge({
  className = "",
  onCompactHistory,
  messagesCount = 0,
}: ContextUsageGaugeProps) {
  const metrics = useAtomValue(chat2MetricsAtom);
  const isCompacting = useAtomValue(isCompactingAtom);
  const [numCtx, setNumCtx] = useAtom(chat2NumCtxAtom);
  const [isStateful, setIsStateful] = useAtom(chat2IsStatefulAtom);
  const [autoCompact, setAutoCompact] = useAtom(chat2AutoCompactAtom);
  const [slidingWindowEnabled, setSlidingWindowEnabled] = useAtom(chat2SlidingWindowAtom);
  const [showClassifier, setShowClassifier] = useAtom(chat2ShowClassifierAtom);

  const activeLimit = metrics ? metrics.numCtx : numCtx;
  const targetPercent = metrics ? metrics.percentConsumed : 0;
  const animatedPercent = useAnimatedNumber(targetPercent, 600);
  const ctxK = (activeLimit / 1024).toFixed(1);

  // Flash highlight when percentage changes significantly (e.g. compaction drops)
  const [isFlashing, setIsFlashing] = useState(false);
  const prevTargetRef = useRef(targetPercent);

  useEffect(() => {
    if (Math.abs(targetPercent - prevTargetRef.current) > 2) {
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 900);
      prevTargetRef.current = targetPercent;
      return () => clearTimeout(timer);
    }
    prevTargetRef.current = targetPercent;
  }, [targetPercent]);

  const displayPercent = animatedPercent.toFixed(1);

  return (
    <div
      className={`chat2-context-gauge flex items-center justify-between px-2.5 py-1 text-[10px] text-muted-foreground select-none ${className}`}
    >
      <div className="chat2-context-gauge-left flex items-center gap-1.5 min-w-0">
        <span className="chat2-context-label font-medium text-foreground/80">Context:</span>
        <span
          className={`chat2-context-value font-mono font-semibold transition-all duration-300 ${
            isFlashing
              ? "text-emerald-400 font-bold scale-105"
              : targetPercent > 90
              ? "text-red-400"
              : targetPercent > 75
              ? "text-amber-400"
              : "text-primary"
          }`}
        >
          {displayPercent}% of {ctxK}k
        </span>
      </div>

      <div className="chat2-context-gauge-right flex items-center gap-1.5 shrink-0">
        {/* MCP Server Status Popover */}
        <McpStatusPopover />

        {/* Custom num_ctx & Context Options Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="p-1 -mr-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Configure context window & compaction settings"
            >
              <SlidersHorizontal className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            sideOffset={8}
            className="w-80 p-3.5 space-y-3 bg-popover/95 backdrop-blur-xl border border-border/60 shadow-xl rounded-xl"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Context Window Size</span>
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

            {/* Context Switches Section */}
            <div className="space-y-2 pt-2 border-t border-border/40">
              {/* Sliding Window Switch */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col pr-2">
                  <span className="text-xs font-semibold text-foreground">Sliding Window Context</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">
                    Prunes oldest turns when exceeding 75% of context limit
                  </span>
                </div>
                <Switch
                  checked={slidingWindowEnabled}
                  onCheckedChange={setSlidingWindowEnabled}
                  className="scale-75 origin-right cursor-pointer shrink-0"
                />
              </div>

              {/* Auto Compact Switch */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col pr-2">
                  <span className="text-xs font-semibold text-foreground">Auto Compact History</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">
                    Folds large tool payloads and summarizes completed turns
                  </span>
                </div>
                <Switch
                  checked={autoCompact}
                  onCheckedChange={setAutoCompact}
                  className="scale-75 origin-right cursor-pointer shrink-0"
                />
              </div>

              {/* Stateful / Multi-turn History Switch */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col pr-2">
                  <span className="text-xs font-semibold text-foreground">Multi-turn History (Stateful)</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">
                    Sends conversation history with each prompt
                  </span>
                </div>
                <Switch
                  checked={isStateful}
                  onCheckedChange={setIsStateful}
                  className="scale-75 origin-right cursor-pointer shrink-0"
                />
              </div>

              {/* Show Tool Classifier Debug Bar Switch */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col pr-2">
                  <span className="text-xs font-semibold text-foreground">Tool Classifier Bar</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">
                    Shows real-time predicted tools above input box
                  </span>
                </div>
                <Switch
                  checked={showClassifier}
                  onCheckedChange={setShowClassifier}
                  className="scale-75 origin-right cursor-pointer shrink-0"
                />
              </div>
            </div>

            {/* Manual Compact History Button */}
            {onCompactHistory && (
              <div className="pt-2 border-t border-border/40 space-y-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCompactHistory}
                  disabled={isCompacting || messagesCount < 2}
                  className="w-full flex items-center justify-center gap-1.5 text-xs h-8 cursor-pointer hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-colors"
                >
                  {isCompacting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      <span>Compacting History...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                      <span>Compact Conversation Now</span>
                    </>
                  )}
                </Button>
                <p className="text-[9px] text-muted-foreground leading-relaxed">
                  Compresses all previous turns into an executive summary, freeing up context headroom immediately.
                </p>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
