import React, { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink, FileText, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createTabAtom } from "@/stores/TabStore";

import { CitedSource } from "../types/citations";

export interface CitationBadgeProps {
  citationId: number;
  sources: CitedSource[];
}

export const CitationBadge: React.FC<CitationBadgeProps> = ({
  citationId,
  sources,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const createTab = useSetAtom(createTabAtom);
  const navigate = useNavigate();

  const source = sources.find((s) => s.citationId === citationId);

  // Graceful fallback if source data is not found
  if (!source) {
    return (
      <span className="inline-flex items-center justify-center min-w-[15px] h-[15px] px-1 text-[10px] font-mono font-medium rounded bg-muted/60 text-muted-foreground align-super select-none">
        [{citationId}]
      </span>
    );
  }

  const isKnowledge = source.type === "knowledge";

  const handleOpenSource = async () => {
    if (isKnowledge && source.filePath) {
      const fileName =
        source.relativePath?.split("/").pop() ||
        source.filePath.split(/[\/\\]/).pop() ||
        source.title;
      createTab({
        filePath: source.filePath,
        fileName,
        switchTo: true,
        // lineStart is 0-based from Rust; editors expect 1-based
        lineNumber: source.lineStart !== undefined ? source.lineStart + 1 : undefined,
      });
      navigate("/editor");
      setIsOpen(false);
    } else if (source.url) {
      try {
        await openUrl(source.url);
      } catch {
        window.open(source.url, "_blank");
      }
      setIsOpen(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Source citation ${citationId}: ${source.title}`}
          className="inline-flex items-center justify-center min-w-[17px] h-[17px] px-1 mx-0.5 text-[10px] font-mono font-semibold text-primary bg-primary/10 hover:bg-primary/20 active:scale-95 border border-primary/20 rounded-md transition-all cursor-pointer align-super shadow-2xs select-none"
        >
          {citationId}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="top"
        sideOffset={6}
        className="w-80 p-3 text-xs space-y-2.5 shadow-lg border-border/70 bg-popover/95 backdrop-blur-md rounded-lg"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {isKnowledge ? (
              <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
            ) : (
              <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            )}
            <span
              className="font-semibold text-foreground truncate text-xs"
              title={source.title}
            >
              {source.title}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {source.score !== undefined && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-primary/10 text-primary">
                {Math.round(source.score * 100)}% match
              </span>
            )}
          </div>
        </div>

        {/* Path or Domain info */}
        <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-1.5 flex-wrap">
          {isKnowledge ? (
            <>
              <span className="truncate max-w-[160px]">
                {source.relativePath || source.filePath}
              </span>
              {source.sectionSlug && (
                <span className="text-primary/80 font-sans">
                  #{source.sectionSlug}
                </span>
              )}
              {source.lineStart !== undefined && (
                <span className="ml-auto shrink-0 px-1.5 py-0.5 rounded text-[9px] font-sans font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Line {source.lineStart + 1}
                </span>
              )}
            </>
          ) : (
            <span className="truncate">{source.url}</span>
          )}
        </div>

        {/* Quoted snippet excerpt */}
        {source.snippet ? (
          <div className="p-2 rounded bg-muted/40 border border-border/40 text-foreground/90 text-[11px] leading-relaxed italic max-h-28 overflow-y-auto select-text">
            &ldquo;{source.snippet.slice(0, 260).trim()}
            {source.snippet.length > 260 ? "…" : ""}&rdquo;
          </div>
        ) : null}

        {/* Action Button */}
        <button
          type="button"
          onClick={handleOpenSource}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer shadow-xs"
        >
          {isKnowledge ? (
            <>
              <FileText className="w-3.5 h-3.5" />
              <span>Open in Editor</span>
            </>
          ) : (
            <>
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Source URL</span>
            </>
          )}
        </button>
      </PopoverContent>
    </Popover>
  );
};
