import { searchWeb } from "@/api-client/web-search";

export interface SearchWebArgs {
  query: string;
  limit?: number;
}

export interface FormattedWebSearchItem {
  citationId: number;
  sourceTag: string;
  title: string;
  snippet: string;
  url: string;
}

export interface SearchWebResult {
  query: string;
  total_found: number;
  instruction?: string;
  message?: string;
  results: FormattedWebSearchItem[];
}

export async function searchWebTool(args: SearchWebArgs): Promise<SearchWebResult> {
  const query = args.query?.trim();
  if (!query) {
    throw new Error("Search query must not be empty.");
  }

  const limit = typeof args.limit === "number" && args.limit > 0 ? Math.min(args.limit, 10) : 5;

  try {
    const rawResult = await searchWeb(query, limit);
    const results: FormattedWebSearchItem[] = (rawResult.results || []).map((item, index) => {
      const citationId = index + 1;
      return {
        citationId,
        sourceTag: `[Source ${citationId}]`,
        title: item.title,
        snippet: item.snippet,
        url: item.url,
      };
    });

    return {
      query: rawResult.query || query,
      total_found: results.length,
      instruction:
        "When referencing facts from these web sources, synthesize in your own words and place inline citation links like [1](cite:1) or [2](cite:2) corresponding to citationId.",
      message: rawResult.message,
      results,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to search the web for '${query}': ${errorMsg}`);
  }
}
