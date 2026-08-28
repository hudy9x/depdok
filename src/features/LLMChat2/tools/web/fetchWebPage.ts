import { fetchWebPage, WebPageResult } from "@/api-client/web-search";

export interface FetchWebPageArgs {
  url: string;
}

export type FetchWebPageResult = WebPageResult;

export async function fetchWebPageTool(args: FetchWebPageArgs): Promise<FetchWebPageResult> {
  const url = args.url?.trim();
  if (!url) {
    throw new Error("URL must not be empty.");
  }

  try {
    const result = await fetchWebPage(url);
    return result;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch webpage at '${url}': ${errorMsg}`);
  }
}
