import { searchWeb, WebSearchResult } from "@/api-client/web-search";

export interface SearchWebArgs {
  query: string;
  limit?: number;
}

export type SearchWebResult = WebSearchResult;

export async function searchWebTool(args: SearchWebArgs): Promise<SearchWebResult> {
  const query = args.query?.trim();
  if (!query) {
    throw new Error("Search query must not be empty.");
  }

  const limit = typeof args.limit === "number" && args.limit > 0 ? Math.min(args.limit, 10) : 5;

  try {
    const result = await searchWeb(query, limit);
    return result;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to search the web for '${query}': ${errorMsg}`);
  }
}
