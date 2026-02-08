import { useEffect, useState, useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { tabsAtom, switchTabAtom, createTabAtom } from "@/stores/TabStore";
import { workspaceRootAtom } from "@/features/FileExplorer/store";
import { FileIcon } from "@/components/FileIcon";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { fuzzySearchFiles, SearchResult } from "./api";


interface CombinedResult {
  type: "tab" | "workspace";
  path: string;
  fileName: string;
  tabId?: string;
  score?: number;
}

export function FileSearchDialog() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [workspaceResults, setWorkspaceResults] = useState<SearchResult[]>([]);
  const tabs = useAtomValue(tabsAtom);
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const switchTab = useSetAtom(switchTabAtom);
  const createTab = useSetAtom(createTabAtom);

  // Register Cmd/Ctrl+P keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "p" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setWorkspaceResults([]);
    }
  }, [open]);

  // Debounced workspace search
  useEffect(() => {
    if (!workspaceRoot || !searchQuery) {
      setWorkspaceResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await fuzzySearchFiles(searchQuery, 50);
        setWorkspaceResults(results);
      } catch (error) {
        console.error("Failed to search workspace files:", error);
        setWorkspaceResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, workspaceRoot]);

  // Combine and deduplicate results
  const combinedResults = useMemo<CombinedResult[]>(() => {
    const results: CombinedResult[] = [];
    const seenPaths = new Set<string>();

    // Add open tabs first (they take priority)
    for (const tab of tabs) {
      results.push({
        type: "tab",
        path: tab.filePath,
        fileName: tab.fileName,
        tabId: tab.id,
      });
      seenPaths.add(tab.filePath);
    }

    // Add workspace results if workspace is open
    if (workspaceRoot) {
      for (const result of workspaceResults) {
        const fullPath = `${workspaceRoot}/${result.path}`;
        if (!seenPaths.has(fullPath)) {
          const fileName = result.path.split("/").pop() || result.path;
          results.push({
            type: "workspace",
            path: result.path,
            fileName,
            score: result.score,
          });
        }
      }
    }

    return results;
  }, [tabs, workspaceResults, workspaceRoot]);

  const handleSelect = (result: CombinedResult) => {
    if (result.type === "tab" && result.tabId) {
      switchTab(result.tabId);
    } else if (result.type === "workspace" && workspaceRoot) {
      const fullPath = `${workspaceRoot}/${result.path}`;
      createTab({
        filePath: fullPath,
        fileName: result.fileName,
        switchTo: true,
        isPreview: true,
      });
    }
    setOpen(false);
  };

  // Separate results by type
  const tabResults = combinedResults.filter((r) => r.type === "tab");
  const workspaceOnlyResults = combinedResults.filter((r) => r.type === "workspace");

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder={workspaceRoot ? "Search files..." : "Search tabs..."}
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>No files found.</CommandEmpty>

        {tabResults.length > 0 && (
          <CommandGroup heading="Open Files">
            {tabResults.map((result) => (
              <CommandItem
                key={result.tabId}
                value={result.fileName}
                onSelect={() => handleSelect(result)}
                className="cursor-pointer"
              >
                <FileIcon filename={result.fileName} className="mr-2" />
                <div className="flex flex-col">
                  <span>{result.fileName}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {result.path}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {workspaceOnlyResults.length > 0 && (
          <CommandGroup heading="Workspace Files">
            {workspaceOnlyResults.map((result, idx) => (
              <CommandItem
                key={`workspace-${idx}`}
                value={result.path}
                onSelect={() => handleSelect(result)}
                className="cursor-pointer"
              >
                <FileIcon filename={result.fileName} className="mr-2" />
                <div className="flex flex-col">
                  <span>{result.fileName}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {result.path}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
