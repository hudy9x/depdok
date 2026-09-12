export interface CitedSource {
  citationId: number;
  type: "knowledge" | "web";
  title: string;
  sourceTag: string;
  snippet: string;
  // Knowledge base specific
  filePath?: string;
  relativePath?: string;
  sectionSlug?: string | null;
  score?: number;
  matchedChunks?: string[];
  lineStart?: number;
  // Web specific
  url?: string;
}
