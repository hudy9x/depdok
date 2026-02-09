import { useEffect, useState, useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { createTabAtom } from "@/stores/TabStore";
import { workspaceRootAtom } from "@/features/FileExplorer/store";
import { Virtuoso } from "react-virtuoso";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { ContentSearchResult } from "./api";
import { useContentSearch } from "./useContentSearch";
import { SearchInput } from "./SearchInput";
import { FileGroupHeader } from "./FileGroupHeader";
import { ResultItem } from "./ResultItem";

interface VirtualItem {
  type: 'header' | 'result';
  data: any;
}

export function ContentSearchDialog() {
  const [open, setOpen] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const createTab = useSetAtom(createTabAtom);

  const { searchQuery, setSearchQuery, results, isSearching } = useContentSearch(workspaceRoot ?? undefined);


  // Register Cmd/Ctrl+Shift+F keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "f" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
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
      setExpandedFiles(new Set());
    }
  }, [open, setSearchQuery]);

  // Auto-expand all files when results arrive
  useEffect(() => {
    if (results.length > 0) {
      const fileSet = new Set(results.map(r => r.file_path));
      setExpandedFiles(fileSet);
    }
  }, [results]);

  // Selected index for keyboard navigation
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const handleSelect = (result: ContentSearchResult) => {
    if (!workspaceRoot) return;

    const fullPath = `${workspaceRoot}/${result.file_path}`;
    const fileName = result.file_path.split("/").pop() || result.file_path;

    console.log("[ContentSearchDialog] Opening file:", fullPath, "at line:", result.line_number);

    createTab({
      filePath: fullPath,
      fileName,
      switchTo: true,
      isPreview: false, // Changed to false to ensure tab stays open
      lineNumber: result.line_number,
    });

    setOpen(false);
  };

  // Group results by file
  const groupedResults = useMemo(() => {
    const groups = new Map<string, ContentSearchResult[]>();
    results.forEach((result) => {
      const existing = groups.get(result.file_path) || [];
      existing.push(result);
      groups.set(result.file_path, existing);
    });
    return groups;
  }, [results]);

  // Toggle file group expansion
  const toggleFileGroup = (filePath: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  // Flatten groups into virtualized list
  const virtualizedItems = useMemo(() => {
    const items: VirtualItem[] = [];

    Array.from(groupedResults.entries()).forEach(([filePath, fileResults]) => {
      // Add file header
      items.push({
        type: 'header',
        data: {
          filePath,
          count: fileResults.length,
          isExpanded: expandedFiles.has(filePath)
        }
      });

      // Add results if expanded
      if (expandedFiles.has(filePath)) {
        fileResults.forEach(result => {
          items.push({ type: 'result', data: result });
        });
      }
    });

    return items;
  }, [groupedResults, expandedFiles]);

  // Keyboard navigation (only when dialog is open)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Get only result items (not headers)
      const resultItems = virtualizedItems.filter(item => item.type === 'result');

      if (resultItems.length === 0) return;

      if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % resultItems.length);
      } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + resultItems.length) % resultItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selectedResult = resultItems[selectedIndex]?.data as ContentSearchResult;
        if (selectedResult) {
          handleSelect(selectedResult);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, virtualizedItems, selectedIndex]);

  // Render virtualized item
  const renderItem = (_index: number, item: VirtualItem) => {
    if (item.type === 'header') {
      const { filePath, count, isExpanded } = item.data;
      return (
        <FileGroupHeader
          filePath={filePath}
          count={count}
          isExpanded={isExpanded}
          onToggle={toggleFileGroup}
        />
      );
    }

    // Result item - calculate if selected
    const result = item.data as ContentSearchResult;
    const resultItems = virtualizedItems.filter(i => i.type === 'result');
    const resultIndex = resultItems.findIndex(i => i.data === item.data);
    const isSelected = resultIndex === selectedIndex;

    return (
      <ResultItem
        result={result}
        searchQuery={searchQuery}
        onSelect={handleSelect}
        isSelected={isSelected}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl h-[80vh] p-0 gap-0 flex flex-col bg-transparent shadow-none border-0">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          disabled={!workspaceRoot}
          isSearching={isSearching}
          workspaceRoot={workspaceRoot ?? undefined}
        />

        {/* Results List with Virtuoso - Fixed height container */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {!workspaceRoot && (
            <div className="py-12 text-center text-sm text-muted-foreground bg-background rounded-md border border-border mt-2">
              Please open a workspace to search content.
            </div>
          )}

          {workspaceRoot && !isSearching && results.length === 0 && searchQuery && (
            <div className="py-12 text-center text-sm text-muted-foreground bg-background rounded-md border border-border mt-2">
              No results found.
            </div>
          )}

          {workspaceRoot && results.length > 0 && (
            <Virtuoso
              style={{ height: '100%' }}
              data={virtualizedItems}
              className="mt-2"
              itemContent={renderItem}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
