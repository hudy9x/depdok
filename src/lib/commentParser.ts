import { type CommentThread } from '@/stores/commentStore';

const COMMENT_PREFIX = 'DEPDOK_COMMENT_';

/**
 * Extract comment threads from the bottom of a markdown string.
 * Comments are stored as HTML comment blocks: <!-- DEPDOK_COMMENT_<id>: {...} -->
 * Returns the cleaned markdown (without comment blocks) and the parsed threads.
 */
export function extractComments(markdown: string): {
  cleanMarkdown: string;
  threads: CommentThread[];
} {
  const threads: CommentThread[] = [];
  const commentRegex = /<!--\s*DEPDOK_COMMENT_([^:]+):\s*([\s\S]*?)\s*-->/g;

  let match: RegExpExecArray | null;
  while ((match = commentRegex.exec(markdown)) !== null) {
    try {
      const data = JSON.parse(match[2]) as CommentThread;
      threads.push(data);
    } catch (e) {
      console.error('[commentParser] Failed to parse comment block', match[1], e);
    }
  }

  // Remove all comment blocks from the markdown
  const cleanMarkdown = markdown
    .replace(commentRegex, '')
    .replace(/\n{3,}$/g, '\n')
    .trimEnd();

  return { cleanMarkdown, threads };
}

/**
 * Append comment thread data as HTML comment blocks to the end of a markdown string.
 */
export function appendComments(markdown: string, threads: CommentThread[]): string {
  if (threads.length === 0) return markdown;

  const commentBlocks = threads
    .map(
      (thread) =>
        `<!-- ${COMMENT_PREFIX}${thread.id}: ${JSON.stringify(thread)} -->`
    )
    .join('\n');

  return `${markdown.trimEnd()}\n\n${commentBlocks}`;
}

/**
 * Generate a unique comment ID.
 */
export function generateCommentId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
