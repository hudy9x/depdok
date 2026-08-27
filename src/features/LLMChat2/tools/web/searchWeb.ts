import { toast } from "sonner";
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

    if (result.total_found > 0) {
      toast.info(`Searched web for "${query}"`, {
        description: `Found ${result.total_found} top results`,
      });
    } else {
      toast.warning(`No web results found for "${query}"`);
    }

    return result;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    toast.error(`Web search failed: ${errorMsg}`);
    throw new Error(`Failed to search the web for '${query}': ${errorMsg}`);
  }
}
