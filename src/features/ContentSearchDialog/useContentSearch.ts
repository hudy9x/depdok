import { useState, useEffect } from "react";
import { searchContent, setContentSearchWorkspace, ContentSearchResult } from "./api";

export function useContentSearch(workspaceRoot: string | undefined) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<ContentSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Set workspace path when it changes
  useEffect(() => {
    if (workspaceRoot) {
      console.log("[ContentSearchDialog] Setting workspace:", workspaceRoot);
      setContentSearchWorkspace(workspaceRoot).catch((error) => {
        console.error("[ContentSearchDialog] Failed to set content search workspace:", error);
      });
    }
  }, [workspaceRoot]);

  // Debounced content search
  useEffect(() => {
    if (!workspaceRoot || !searchQuery) {
      setResults([]);
      return;
    }

    console.log("[ContentSearchDialog] Triggering search for:", searchQuery);

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        console.log("[ContentSearchDialog] Calling searchContent API...");
        const searchResults = await searchContent(searchQuery, {
          max_results: 500,
          case_sensitive: false,
        });
        console.log("[ContentSearchDialog] Received results:", searchResults.length, "matches");
        setResults(searchResults);
      } catch (error) {
        console.error("[ContentSearchDialog] Failed to search content:", error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, workspaceRoot]);

  return {
    searchQuery,
    setSearchQuery,
    results,
    isSearching,
  };
}
