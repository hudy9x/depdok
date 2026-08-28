import React, { useEffect, useState, useMemo } from "react";
import { useAtomValue } from "jotai";
import { Folder } from "lucide-react";
import { tabsAtom } from "@/stores/TabStore";
import { workspaceRootAtom } from "@/features/FileExplorer/store";
import { FileIcon } from "@/components/FileIcon";
import { fuzzySearchFiles, SearchResult } from "@/features/FileSearchDialog/api";
import { listDirectory, FileEntry } from "@/features/FileExplorer/api";

export interface MentionItem {
  type: "tab" | "workspace" | "file" | "folder";
  fileName: string;
  relativePath: string;
  fullPath: string;
  isDir?: boolean;
}

interface FileMentionPopupProps {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
  onItemsChange?: (items: MentionItem[]) => void;
}

function getRelevanceScore(item: MentionItem, query: string, baseScore = 0): number {
  if (!query) {
    return item.type === "tab" ? 100 : 10;
  }

  const q = query.toLowerCase().trim();
  const name = item.fileName.toLowerCase();
  const nameWithoutExt = name.replace(/\.[^/.]+$/, "");
  const rel = item.relativePath.toLowerCase();
  const relWithoutSlash = rel.replace(/[/\\]+$/, "");
  const parts = rel.split(/[/\\]/).filter(Boolean);

  let score = baseScore;

  // 1. Exact match on filename, stem, relative path, or folder name
  if (name === q || nameWithoutExt === q || rel === q || relWithoutSlash === q) {
    score += 40000;
  }
  // 2. Exact match on one of the directory path segments
  else if (parts.some((p) => p === q || p.replace(/\.[^/.]+$/, "") === q)) {
    score += 25000;
  }
  // 3. Name or stem starts with query
  else if (name.startsWith(q) || nameWithoutExt.startsWith(q)) {
    score += 15000;
  }
  // 4. Relative path starts with query
  else if (rel.startsWith(q)) {
    score += 10000;
  }
  // 5. Name contains query
  else if (name.includes(q)) {
    score += 5000;
  }
  // 6. Path contains query
  else if (rel.includes(q)) {
    score += 2000;
  }

  // Exact folder match bonus when item is folder
  if (item.isDir || item.type === "folder") {
    if (name === q || relWithoutSlash === q) {
      score += 5000;
    }
  }

  // Slight tie-breaker for open tabs
  if (item.type === "tab") {
    score += 5;
  }

  return score;
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
  const [rootEntries, setRootEntries] = useState<FileEntry[]>([]);

  // When query is empty and popup opens, fetch top-level workspace entries
  useEffect(() => {
    if (!isOpen || !workspaceRoot || query.trim()) {
      setRootEntries([]);
      return;
    }

    listDirectory(workspaceRoot)
      .then((entries) => {
        setRootEntries(entries);
      })
      .catch((err) => {
        console.warn("Failed to list top directory for mention popup:", err);
        setRootEntries([]);
      });
  }, [isOpen, query, workspaceRoot]);

  // Search workspace files and folders on debounced query
  useEffect(() => {
    if (!isOpen || !workspaceRoot || !query.trim()) {
      setWorkspaceResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await fuzzySearchFiles(query, 25);
        setWorkspaceResults(results);
      } catch (err) {
        console.error("Failed to fuzzy search files for mention popup:", err);
        setWorkspaceResults([]);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [isOpen, query, workspaceRoot]);

  // Combine tabs and workspace files/folders with relevance sorting
  const items = useMemo<MentionItem[]>(() => {
    const list: { item: MentionItem; score: number }[] = [];
    const seen = new Set<string>();
    const lowerQuery = query.toLowerCase().trim();

    // 1. Open tabs that match query
    for (const tab of tabs) {
      if (tab.filePath.startsWith("UNTITLED://")) continue;
      const relPath = workspaceRoot && tab.filePath.startsWith(workspaceRoot)
        ? tab.filePath.slice(workspaceRoot.length).replace(/^[/\\]+/, "")
        : tab.fileName;

      if (!query || tab.fileName.toLowerCase().includes(lowerQuery) || relPath.toLowerCase().includes(lowerQuery)) {
        if (!seen.has(relPath)) {
          seen.add(relPath);
          const mentionItem: MentionItem = {
            type: "tab",
            fileName: tab.fileName,
            relativePath: relPath,
            fullPath: tab.filePath,
            isDir: false,
          };
          list.push({
            item: mentionItem,
            score: getRelevanceScore(mentionItem, query),
          });
        }
      }
    }

    // 2. Top-level workspace entries when query is empty
    if (!query && rootEntries.length > 0) {
      for (const entry of rootEntries) {
        if (entry.name.startsWith(".")) continue;
        if (!seen.has(entry.name)) {
          seen.add(entry.name);
          const mentionItem: MentionItem = {
            type: entry.is_dir ? "folder" : "file",
            fileName: entry.name,
            relativePath: entry.name,
            fullPath: entry.path,
            isDir: entry.is_dir,
          };
          list.push({
            item: mentionItem,
            score: getRelevanceScore(mentionItem, query),
          });
        }
      }
    }

    // 3. Workspace fuzzy search results (files & folders)
    for (const res of workspaceResults) {
      const fileName = res.path.split(/[/\\]/).pop() || res.path;
      if (!seen.has(res.path)) {
        seen.add(res.path);
        const mentionItem: MentionItem = {
          type: res.is_dir ? "folder" : "file",
          fileName,
          relativePath: res.path,
          fullPath: workspaceRoot ? `${workspaceRoot}/${res.path}` : res.path,
          isDir: res.is_dir,
        };
        list.push({
          item: mentionItem,
          score: getRelevanceScore(mentionItem, query, res.score),
        });
      }
    }

    // Sort descending by calculated relevance score
    list.sort((a, b) => b.score - a.score);

    return list.slice(0, 12).map((entry) => entry.item);
  }, [tabs, rootEntries, workspaceResults, workspaceRoot, query]);

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
          Mention File or Folder (@)
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
          No files or folders matching &quot;@{query}&quot;
        </div>
      ) : (
        <div className="space-y-0.5">
          {items.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            const isFolder = Boolean(item.isDir || item.type === "folder");

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
                {isFolder ? (
                  <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                ) : (
                  <FileIcon filename={item.fileName} className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="font-medium shrink-0 truncate max-w-[140px]">{item.fileName}</span>
                <span className="text-[10px] text-muted-foreground truncate font-mono flex-1 text-right">
                  {item.relativePath}
                </span>
                {item.type === "tab" ? (
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-muted text-muted-foreground shrink-0">
                    tab
                  </span>
                ) : isFolder ? (
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                    folder
                  </span>
                ) : (
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-muted text-muted-foreground shrink-0">
                    file
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
