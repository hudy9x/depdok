import { getDefaultStore } from "jotai";

import { searchHybrid, HybridSearchResult } from "@/api-client/knowledge-base";
import { workspaceRootAtom } from "@/features/FileExplorer/store";

export interface SearchKnowledgeBaseArgs {
  query: string;
  limit?: number;
  project?: string;
  projectId?: string;
}

export interface FormattedKnowledgeMatch {
  citationId: number;
  sourceTag: string;
  documentId: string;
  title: string;
  filePath: string;
  relativePath: string;
  sectionSlug: string | null;
  score: number;
  content: string;
  matchedChunks: string[];
  lineStart?: number;
}

export interface SearchKnowledgeBaseResult {
  query: string;
  totalFound: number;
  message?: string;
  instruction?: string;
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
  const effectiveProjectId =
    (args.project?.trim() || args.projectId?.trim() || workspaceRoot || "").trim() || undefined;

  try {
    const rawResults: HybridSearchResult[] = await searchHybrid(query, limit, effectiveProjectId);

    if (!rawResults || rawResults.length === 0) {
      return {
        query,
        totalFound: 0,
        message:
          "No matching documents found in the knowledge base. Ensure files in the workspace have been indexed.",
        results: [],
      };
    }

    const formattedMatches: FormattedKnowledgeMatch[] = rawResults.map((r, index) => {
      const { filePath, relativePath, sectionSlug } = parseDocumentId(r.documentId, workspaceRoot);

      // Keep max 2000 chars per section content to prevent overflowing context
      const truncatedContent =
        r.content.length > 2000 ? `${r.content.slice(0, 2000)}\n...(truncated)` : r.content;

      const citationId = index + 1;

      return {
        citationId,
        sourceTag: `[Source ${citationId}]`,
        documentId: r.documentId,
        title: r.title,
        filePath,
        relativePath,
        sectionSlug,
        score: Number(r.score.toFixed(4)),
        content: truncatedContent,
        matchedChunks: (r.matchedChunks || []).slice(0, 3),
        lineStart: r.lineStart,
      };
    });

    return {
      query,
      totalFound: formattedMatches.length,
      instruction:
        "When referencing or summarizing facts from these documents, synthesize in your own words and place inline citation links like [1](cite:1) or [2](cite:2) corresponding to citationId.",
      results: formattedMatches,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("searchKnowledgeBaseTool error:", err);
    throw new Error(`Knowledge base search failed: ${errorMsg}`);
  }
}
