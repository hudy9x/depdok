import { invoke } from "@tauri-apps/api/core";

export interface WebSearchResultItem {
  title: string;
  snippet: string;
  url: string;
}

export interface WebSearchResult {
  query: string;
  total_found: number;
  results: WebSearchResultItem[];
  message?: string;
}

export interface WebPageResult {
  url: string;
  title: string;
  content: string;
  character_count: number;
  truncated: boolean;
}

/**
 * Searches the web asynchronously using the Yahoo search scraper backend.
 */
export async function searchWeb(query: string, limit = 5): Promise<WebSearchResult> {
  return await invoke<WebSearchResult>("search_web", {
    query,
    limit,
  });
}

/**
 * Fetches and cleans a webpage content into markdown format.
 */
export async function fetchWebPage(url: string): Promise<WebPageResult> {
  return await invoke<WebPageResult>("fetch_web_page", {
    url,
  });
}
