import { getDefaultStore } from "jotai";
import { workspaceRootAtom } from "@/features/FileExplorer/store";
import { fuzzySearchFiles, indexWorkspaceFiles, SearchResult } from "@/features/FileSearchDialog/api";

export interface SearchFileArgs {
  query: string;
  limit?: number;
}

export interface SearchFileResultItem {
  path: string;
  is_dir: boolean;
  score: number;
}

export interface SearchFileResult {
  success: boolean;
  query: string;
  totalMatches: number;
  results: SearchFileResultItem[];
  message: string;
}

export async function searchFileTool(args: SearchFileArgs): Promise<SearchFileResult> {
  const store = getDefaultStore();
  const workspaceRoot = store.get(workspaceRootAtom) || "";
  const query = args.query?.trim() || "";
  const limit = typeof args.limit === "number" ? Math.min(Math.max(1, args.limit), 100) : 20;

  if (!query) {
    return {
      success: true,
      query: "",
      totalMatches: 0,
      results: [],
      message: "Query was empty. Please provide a search query.",
    };
  }

  try {
    let rawResults: SearchResult[] = [];
    try {
      rawResults = await fuzzySearchFiles(query, limit);
    } catch {
      if (workspaceRoot) {
        await indexWorkspaceFiles(workspaceRoot);
        rawResults = await fuzzySearchFiles(query, limit);
      }
    }

    // If index was empty or stale, reindex and retry once
    if (rawResults.length === 0 && workspaceRoot) {
      await indexWorkspaceFiles(workspaceRoot);
      rawResults = await fuzzySearchFiles(query, limit);
    }

    const items: SearchFileResultItem[] = rawResults.slice(0, limit).map((r) => ({
      path: r.path,
      is_dir: !!r.is_dir,
      score: r.score,
    }));

    return {
      success: true,
      query,
      totalMatches: items.length,
      results: items,
      message: `Found ${items.length} matching file(s)/folder(s) for query '${query}'.`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to search files for '${query}': ${errorMsg}`);
  }
}
