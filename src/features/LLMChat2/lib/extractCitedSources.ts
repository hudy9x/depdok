import { ChatMessage, ToolExecutionLog } from "../store/LLMChat2Store";
import { SearchKnowledgeBaseResult } from "../tools/knowledgeBase/searchKnowledgeBase";
import { SearchWebResult } from "../tools/web/searchWeb";
import { CitedSource } from "../types/citations";

/**
 * Extracts all unique CitedSource items from a ChatMessage's tool execution logs
 * (from both legacy `toolCalls` and modern chronological `parts`).
 */
export function extractCitedSources(message: ChatMessage): CitedSource[] {
  const toolLogs: ToolExecutionLog[] = [];

  // Collect from parts
  if (message.parts && message.parts.length > 0) {
    for (const part of message.parts) {
      if (part.type === "tool" && part.toolCall) {
        toolLogs.push(part.toolCall);
      }
    }
  }

  // Collect from legacy toolCalls
  if (message.toolCalls && message.toolCalls.length > 0) {
    for (const tc of message.toolCalls) {
      if (!toolLogs.some((l) => l.id === tc.id)) {
        toolLogs.push(tc);
      }
    }
  }

  const sources: CitedSource[] = [];

  for (const log of toolLogs) {
    if (log.status !== "success" || !log.result) continue;

    const toolName = log.toolName.toLowerCase();

    // 1. Knowledge Base Search
    if (
      toolName === "search_knowledge_base" ||
      toolName === "semantic_search" ||
      toolName === "search_knowledge"
    ) {
      const kbResult = log.result as SearchKnowledgeBaseResult;
      if (Array.isArray(kbResult.results)) {
        for (const item of kbResult.results) {
          if (!item.citationId) continue;
          // Deduplicate by citationId
          if (!sources.some((s) => s.citationId === item.citationId)) {
            sources.push({
              citationId: item.citationId,
              type: "knowledge",
              title: item.title || item.relativePath || "Document",
              sourceTag: item.sourceTag || `[Source ${item.citationId}]`,
              filePath: item.filePath,
              relativePath: item.relativePath,
              sectionSlug: item.sectionSlug,
              score: item.score,
              matchedChunks: item.matchedChunks,
              lineStart: item.lineStart,
              snippet: item.content || (item.matchedChunks && item.matchedChunks[0]) || "",
            });
          }
        }
      }
    }

    // 2. Web Search
    if (
      toolName === "web_search" ||
      toolName === "search_web" ||
      toolName === "internet_search"
    ) {
      const webResult = log.result as SearchWebResult;
      if (Array.isArray(webResult.results)) {
        for (const item of webResult.results) {
          if (!item.citationId) continue;
          if (!sources.some((s) => s.citationId === item.citationId)) {
            sources.push({
              citationId: item.citationId,
              type: "web",
              title: item.title || item.url || "Web Page",
              sourceTag: item.sourceTag || `[Source ${item.citationId}]`,
              url: item.url,
              snippet: item.snippet || "",
            });
          }
        }
      }
    }
  }

  // Sort ascending by citationId
  return sources.sort((a, b) => a.citationId - b.citationId);
}
