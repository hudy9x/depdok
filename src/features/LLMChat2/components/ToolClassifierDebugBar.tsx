import React from "react";
import { Loader2, Wrench, Zap, Terminal, FileText, Folder, Globe, Database, Table, Layers, CheckCircle2, Check } from "lucide-react";
import { useAtom } from "jotai";
import { cn } from "@/lib/utils";
import { useToolClassifier } from "../hooks/useToolClassifier";
import { chat2EnableCategoriesAtom, chat2EnableFilterAtom } from "../store/LLMChat2Store";

export interface ToolClassifierDebugBarProps {
  inputVal: string;
  model?: string;
  className?: string;
}

export const ToolClassifierDebugBar: React.FC<ToolClassifierDebugBarProps> = ({
  inputVal,
  model,
  className,
}) => {
  const [enableCategories, setEnableCategories] = useAtom(chat2EnableCategoriesAtom);
  const [enableFilter, setEnableFilter] = useAtom(chat2EnableFilterAtom);

  const { label, tools, isClassifying, estimatedTokens, error } = useToolClassifier(
    inputVal,
    model,
    500,
    enableCategories,
    enableFilter
  );

  // If input is empty and no classification result, do not render anything
  if (!inputVal.trim() && !label && !isClassifying) {
    return null;
  }

  const getLabelBadgeStyle = (lbl: string | null) => {
    switch (lbl) {
      case "NONE":
        return "bg-zinc-500/10 text-zinc-500 border-zinc-500/20";
      case "FILE":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "FOLDER":
        return "bg-indigo-500/10 text-indigo-500 border-indigo-500/20";
      case "WEB":
        return "bg-cyan-500/10 text-cyan-500 border-cyan-500/20";
      case "SHELL":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "KNOWLEDGE":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "SPREADSHEET":
        return "bg-teal-500/10 text-teal-500 border-teal-500/20";
      case "ALL":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getLabelIcon = (lbl: string | null) => {
    switch (lbl) {
      case "NONE":
        return <CheckCircle2 className="w-3 h-3" />;
      case "FILE":
        return <FileText className="w-3 h-3" />;
      case "FOLDER":
        return <Folder className="w-3 h-3" />;
      case "WEB":
        return <Globe className="w-3 h-3" />;
      case "SHELL":
        return <Terminal className="w-3 h-3" />;
      case "KNOWLEDGE":
        return <Database className="w-3 h-3" />;
      case "SPREADSHEET":
        return <Table className="w-3 h-3" />;
      case "ALL":
        return <Layers className="w-3 h-3" />;
      default:
        return <Zap className="w-3 h-3" />;
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 px-2.5 py-1.5 mb-1.5 rounded-xl bg-muted/40 border border-border/60 text-xs transition-all animate-in fade-in slide-in-from-bottom-1 duration-150",
        className
      )}
    >
      {/* Row 1: Classifier Title + Detected Category Badges */}
      <div className="flex items-center gap-1.5 min-w-0 select-none">
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1">
          <Zap className="w-3 h-3 text-primary" />
          Classifier:
        </span>

        {isClassifying ? (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin text-primary" />
            <span>Triage...</span>
          </div>
        ) : label ? (
          <div className="flex flex-wrap items-center gap-1">
            {label.split(" + ").map((subLabel) => (
              <span
                key={subLabel}
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border uppercase tracking-wider",
                  getLabelBadgeStyle(subLabel)
                )}
              >
                {getLabelIcon(subLabel)}
                {subLabel}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground italic">Waiting for input...</span>
        )}
      </div>

      {/* Row 2: Token Consumption Badge + Layer 2 & Layer 3 Filter Checkboxes */}
      <div className="flex flex-wrap items-center justify-start gap-2.5 select-none">
        {/* Consumed Tokens Badge */}
        {estimatedTokens !== null && estimatedTokens > 0 && (
          <span
            className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 font-semibold shrink-0"
            title="Estimated token consumption of active tool schemas in Ollama context"
          >
            ~{estimatedTokens} tokens
          </span>
        )}

        {/* Layer 2: Categories Switch */}
        <label className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors shrink-0">
          <div
            onClick={() => setEnableCategories(!enableCategories)}
            className={cn(
              "w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors",
              enableCategories
                ? "bg-primary border-primary text-primary-foreground"
                : "bg-background border-border"
            )}
          >
            {enableCategories && <Check className="w-2.5 h-2.5 stroke-[3]" />}
          </div>
          <span className="text-[10px] font-mono">Category (L2)</span>
        </label>

        {/* Layer 3: Filter Switch */}
        <label className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors shrink-0">
          <div
            onClick={() => setEnableFilter(!enableFilter)}
            className={cn(
              "w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors",
              enableFilter
                ? "bg-primary border-primary text-primary-foreground"
                : "bg-background border-border"
            )}
          >
            {enableFilter && <Check className="w-2.5 h-2.5 stroke-[3]" />}
          </div>
          <span className="text-[10px] font-mono">Filter (L3)</span>
        </label>
      </div>

      {/* Error state if any */}
      {error && (
        <div className="text-[10px] text-destructive px-1 line-clamp-1">
          Classifier error: {error}
        </div>
      )}

      {/* Wrapped Tools Container */}
      {tools.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 max-h-[72px] overflow-y-auto pt-0.5 scrollbar-thin">
          {tools.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-background/70 hover:bg-background border border-border/50 text-[10px] font-mono text-foreground/80 transition-colors shadow-2xs"
            >
              <Wrench className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
