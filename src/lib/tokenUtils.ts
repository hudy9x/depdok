export function estimateTokens(text: string): number {
  if (!text) return 0;
  // A common heuristic is 4 characters per token for English text.
  return Math.ceil(text.length / 4);
}
