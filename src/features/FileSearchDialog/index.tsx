import { useEffect, useState, useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { Folder } from "lucide-react";
import { tabsAtom, switchTabAtom, createTabAtom } from "@/stores/TabStore";
import { workspaceRootAtom, revealFileAtom } from "@/features/FileExplorer/store";
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
  is_dir?: boolean;
}

export function FileSearchDialog() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [workspaceResults, setWorkspaceResults] = useState<SearchResult[]>([]);
  const tabs = useAtomValue(tabsAtom);
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const switchTab = useSetAtom(switchTabAtom);
  const createTab = useSetAtom(createTabAtom);
  const revealFile = useSetAtom(revealFileAtom);

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
            is_dir: result.is_dir,
          });
        }
      }
    }

    return results;
  }, [tabs, workspaceResults, workspaceRoot]);

  const handleSelect = (result: CombinedResult) => {
    if (result.type === "tab" && result.tabId) {
      switchTab(result.tabId);
      // Reveal the tab's file in FileExplorer
      revealFile(result.path);
    } else if (result.type === "workspace" && workspaceRoot) {
      const fullPath = `${workspaceRoot}/${result.path}`;
      if (result.is_dir) {
        // Reveal directory in explorer
        revealFile(fullPath);
      } else {
        createTab({
          filePath: fullPath,
          fileName: result.fileName,
          switchTo: true,
          isPreview: true,
        });
        // Reveal the file in FileExplorer
        revealFile(fullPath);
      }
    }
    setOpen(false);
  };

  // Separate results by type
  const tabResults = combinedResults.filter((r) => r.type === "tab");
  const workspaceOnlyResults = combinedResults.filter((r) => r.type === "workspace");

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder={workspaceRoot ? "Search files & folders..." : "Search tabs..."}
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>No matches found.</CommandEmpty>

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
          <CommandGroup heading="Workspace Files &amp; Folders">
            {workspaceOnlyResults.map((result, idx) => (
              <CommandItem
                key={`workspace-${idx}`}
                value={result.path}
                onSelect={() => handleSelect(result)}
                className="cursor-pointer"
              >
                {result.is_dir ? (
                  <Folder className="mr-2 h-4 w-4 text-amber-500 shrink-0" />
                ) : (
                  <FileIcon filename={result.fileName} className="mr-2 shrink-0" />
                )}
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
