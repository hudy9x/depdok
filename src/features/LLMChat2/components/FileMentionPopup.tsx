import React, { useEffect, useState, useMemo } from "react";
import { useAtomValue } from "jotai";
import { tabsAtom } from "@/stores/TabStore";
import { workspaceRootAtom } from "@/features/FileExplorer/store";
import { FileIcon } from "@/components/FileIcon";
import { fuzzySearchFiles, SearchResult } from "@/features/FileSearchDialog/api";

export interface MentionItem {
  type: "tab" | "workspace";
  fileName: string;
  relativePath: string;
  fullPath: string;
}

interface FileMentionPopupProps {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
  onItemsChange?: (items: MentionItem[]) => void;
}

export const FileMentionPopup: React.FC<FileMentionPopupProps> = ({
  isOpen,
  query,
  selectedIndex,
  onSelect,
  onClose,
  onItemsChange,
}) => {
  const tabs = useAtomValue(tabsAtom);
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const [workspaceResults, setWorkspaceResults] = useState<SearchResult[]>([]);

  // Search workspace files on debounced query
  useEffect(() => {
    if (!isOpen || !workspaceRoot) {
      setWorkspaceResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await fuzzySearchFiles(query, 15);
        setWorkspaceResults(results);
      } catch (err) {
        console.error("Failed to fuzzy search files for mention popup:", err);
        setWorkspaceResults([]);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [isOpen, query, workspaceRoot]);

  // Combine tabs and workspace files
  const items = useMemo<MentionItem[]>(() => {
    const list: MentionItem[] = [];
    const seen = new Set<string>();
    const lowerQuery = query.toLowerCase();

    // 1. Open tabs that match query
    for (const tab of tabs) {
      if (tab.filePath.startsWith("UNTITLED://")) continue;
      const relPath = workspaceRoot && tab.filePath.startsWith(workspaceRoot)
        ? tab.filePath.slice(workspaceRoot.length).replace(/^[/\\]+/, "")
        : tab.fileName;

      if (!query || tab.fileName.toLowerCase().includes(lowerQuery) || relPath.toLowerCase().includes(lowerQuery)) {
        if (!seen.has(relPath)) {
          seen.add(relPath);
          list.push({
            type: "tab",
            fileName: tab.fileName,
            relativePath: relPath,
            fullPath: tab.filePath,
          });
        }
      }
    }

    // 2. Workspace results
    for (const res of workspaceResults) {
      const fileName = res.path.split(/[/\\]/).pop() || res.path;
      if (!seen.has(res.path)) {
        seen.add(res.path);
        list.push({
          type: "workspace",
          fileName,
          relativePath: res.path,
          fullPath: workspaceRoot ? `${workspaceRoot}/${res.path}` : res.path,
        });
      }
    }

    return list.slice(0, 10);
  }, [tabs, workspaceResults, workspaceRoot, query]);

  useEffect(() => {
    onItemsChange?.(items);
  }, [items, onItemsChange]);

  if (!isOpen) return null;

  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-2 max-h-56 overflow-y-auto rounded-xl border border-border/80 bg-background/98 backdrop-blur-xl shadow-2xl z-50 p-1.5 animate-in fade-in zoom-in-95 duration-150"
      style={{ boxShadow: "0 -8px 24px rgba(0,0,0,0.3)" }}
    >
      <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-border/40">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Mention File (@)
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-muted-foreground font-mono">
            ↑↓ to navigate • Enter to select
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-[10px] text-muted-foreground hover:text-foreground px-1 rounded hover:bg-muted/60"
            title="Close popup (Esc)"
          >
            ✕
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-3 text-center text-xs text-muted-foreground">
          No files matching &quot;@{query}&quot;
        </div>
      ) : (
        <div className="space-y-0.5">
          {items.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={`${item.type}-${item.relativePath}`}
                type="button"
                onClick={() => onSelect(item)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-sky-500/15 text-sky-400 border border-sky-500/30"
                    : "text-foreground hover:bg-muted/60 border border-transparent"
                }`}
              >
                <FileIcon filename={item.fileName} className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium shrink-0 truncate max-w-[140px]">{item.fileName}</span>
                <span className="text-[10px] text-muted-foreground truncate font-mono flex-1 text-right">
                  {item.relativePath}
                </span>
                {item.type === "tab" && (
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-muted text-muted-foreground shrink-0">
                    tab
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
