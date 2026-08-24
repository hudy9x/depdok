import { getDefaultStore } from "jotai";
import { toast } from "sonner";

import { searchHybrid, HybridSearchResult } from "@/api-client/knowledge-base";
import { workspaceRootAtom } from "@/features/FileExplorer/store";

export interface SearchKnowledgeBaseArgs {
  query: string;
  limit?: number;
}

export interface FormattedKnowledgeMatch {
  documentId: string;
  title: string;
  filePath: string;
  relativePath: string;
  sectionSlug: string | null;
  score: number;
  content: string;
  matchedChunks: string[];
}

export interface SearchKnowledgeBaseResult {
  query: string;
  totalFound: number;
  message?: string;
  results: FormattedKnowledgeMatch[];
}

function parseDocumentId(
  docId: string,
  workspaceRoot: string | null
): { filePath: string; relativePath: string; sectionSlug: string | null } {
  let raw = docId.startsWith("file:") ? docId.slice(5) : docId;
  let sectionSlug: string | null = null;

  const sectionIndex = raw.indexOf("#section:");
  if (sectionIndex !== -1) {
    sectionSlug = raw.slice(sectionIndex + 9);
    raw = raw.slice(0, sectionIndex);
  }

  const filePath = raw;
  let relativePath = filePath;
  if (workspaceRoot && filePath.startsWith(workspaceRoot)) {
    relativePath = filePath.slice(workspaceRoot.length).replace(/^[/\\]+/, "");
  }

  return { filePath, relativePath, sectionSlug };
}

export async function searchKnowledgeBaseTool(
  args: SearchKnowledgeBaseArgs
): Promise<SearchKnowledgeBaseResult> {
  const query = args.query?.trim();
  if (!query) {
    throw new Error("Search query must not be empty.");
  }

  const limit = typeof args.limit === "number" && args.limit > 0 ? Math.min(args.limit, 20) : 6;
  const store = getDefaultStore();
  const workspaceRoot = store.get(workspaceRootAtom);

  try {
    const rawResults: HybridSearchResult[] = await searchHybrid(query, limit);

    if (!rawResults || rawResults.length === 0) {
      toast.info(`No knowledge base matches found for "${query}"`);
      return {
        query,
        totalFound: 0,
        message:
          "No matching documents found in the knowledge base. Ensure files in the workspace have been indexed.",
        results: [],
      };
    }

    const formattedMatches: FormattedKnowledgeMatch[] = rawResults.map((r) => {
      const { filePath, relativePath, sectionSlug } = parseDocumentId(r.documentId, workspaceRoot);

      // Keep max 2000 chars per section content to prevent overflowing context
      const truncatedContent =
        r.content.length > 2000 ? `${r.content.slice(0, 2000)}\n...(truncated)` : r.content;

      return {
        documentId: r.documentId,
        title: r.title,
        filePath,
        relativePath,
        sectionSlug,
        score: Number(r.score.toFixed(4)),
        content: truncatedContent,
        matchedChunks: (r.matchedChunks || []).slice(0, 3),
      };
    });

    toast.info(`Found ${formattedMatches.length} knowledge base matches for "${query}"`);

    return {
      query,
      totalFound: formattedMatches.length,
      results: formattedMatches,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("searchKnowledgeBaseTool error:", err);
    throw new Error(`Knowledge base search failed: ${errorMsg}`);
  }
}
