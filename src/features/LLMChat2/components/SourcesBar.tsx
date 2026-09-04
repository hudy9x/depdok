import React, { useState } from "react";
import { ChevronDown, ChevronRight, FileText, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useSetAtom } from "jotai";

import { createTabAtom } from "@/stores/TabStore";

import { CitedSource } from "../types/citations";

export interface SourcesBarProps {
  sources: CitedSource[];
}

export const SourcesBar: React.FC<SourcesBarProps> = ({ sources }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const createTab = useSetAtom(createTabAtom);
  const navigate = useNavigate();

  if (!sources || sources.length === 0) return null;

  const handleOpenSource = async (source: CitedSource) => {
    if (source.type === "knowledge" && source.filePath) {
      const fileName =
        source.relativePath?.split("/").pop() ||
        source.filePath.split(/[\/\\]/).pop() ||
        source.title;
      createTab({
        filePath: source.filePath,
        fileName,
        switchTo: true,
        lineNumber: source.lineStart !== undefined ? source.lineStart + 1 : undefined,
      });
      navigate("/editor");
    } else if (source.url) {
      try {
        await openUrl(source.url);
      } catch {
        window.open(source.url, "_blank");
      }
    }
  };

  return (
    <div className="w-full mt-2">
      {/* Collapsed: single unobtrusive pill */}
      {!isExpanded && (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors select-none group"
        >
          <div className="flex items-center gap-0.5">
            {sources.slice(0, 3).map((src) => (
              <span
                key={src.citationId}
                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-mono font-bold border border-primary/20 -ml-1 first:ml-0"
              >
                {src.citationId}
              </span>
            ))}
            {sources.length > 3 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted text-muted-foreground text-[8px] font-medium border border-border -ml-1">
                +{sources.length - 3}
              </span>
            )}
          </div>
          <span className="font-medium">
            {sources.length} source{sources.length !== 1 ? "s" : ""}
          </span>
          <ChevronRight className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
        </button>
      )}

      {/* Expanded: full detail list */}
      {isExpanded && (
        <div className="rounded-lg bg-muted/30 border border-border/50 text-xs overflow-hidden">
          {/* Header */}
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="flex items-center justify-between w-full px-3 py-2 text-muted-foreground hover:text-foreground transition-colors select-none text-[11px] font-medium border-b border-border/30"
          >
            <span className="font-medium text-foreground/80">
              {sources.length} Referenced Source{sources.length !== 1 ? "s" : ""}
            </span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {/* Source rows */}
          <div className="divide-y divide-border/20">
            {sources.map((src) => (
              <div
                key={src.citationId}
                className="flex items-start justify-between gap-2 px-3 py-2 hover:bg-background/40 transition-colors group"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <span className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
                    {src.citationId}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-medium text-foreground text-[11px]">
                      {src.type === "knowledge" ? (
                        <FileText className="w-3 h-3 text-primary/70 shrink-0" />
                      ) : (
                        <Globe className="w-3 h-3 text-blue-500 shrink-0" />
                      )}
                      <span className="truncate">{src.title}</span>
                      {src.score !== undefined && (
                        <span className="text-[9px] font-mono text-muted-foreground shrink-0">
                          {Math.round(src.score * 100)}%
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="truncate max-w-[200px]">{src.relativePath || src.url}</span>
                      {src.sectionSlug && (
                        <span className="text-primary/70 shrink-0">#{src.sectionSlug}</span>
                      )}
                      {src.lineStart !== undefined && (
                        <span className="shrink-0 px-1 py-px rounded text-[9px] font-sans font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          Line {src.lineStart + 1}
                        </span>
                      )}
                    </div>

                    {src.snippet && (
                      <p className="text-[10px] text-muted-foreground/80 line-clamp-2 italic mt-1 pl-1 border-l-2 border-primary/20">
                        &ldquo;{src.snippet.slice(0, 160)}&rdquo;
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenSource(src)}
                  className="px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-[10px] font-medium text-foreground shrink-0 transition-colors cursor-pointer"
                >
                  {src.type === "knowledge" ? "Open" : "Visit"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
