import { type CommentThread } from './commentStore';

const COMMENT_PREFIX = 'DEPDOK_COMMENT_';

/**
 * Extract comment threads from the bottom of a markdown string.
 * Comments are stored as HTML comment blocks: <!-- DEPDOK_COMMENT_<id>: {...} -->
 * Returns the cleaned markdown (without comment blocks) and the parsed threads.
 * For resolved comment threads, inline <span data-comment-id="..."> marks are unwrapped to plain text.
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
  let cleanMarkdown = markdown
    .replace(commentRegex, '')
    .replace(/\n{3,}$/g, '\n')
    .trimEnd();

  // Find any orphan inline <span data-comment-id="..."> marks without corresponding comment blocks
  const existingIds = new Set(threads.map((t) => t.id));
  const spanRegex = /<span[^>]*\bdata-comment-id=["']([^"']+)["'][^>]*>/gi;
  let spanMatch: RegExpExecArray | null;
  while ((spanMatch = spanRegex.exec(cleanMarkdown)) !== null) {
    const orphanId = spanMatch[1];
    if (orphanId && !existingIds.has(orphanId)) {
      existingIds.add(orphanId);
      threads.push({
        id: orphanId,
        text: '',
        author: 'Unknown',
        createdAt: new Date().toISOString(),
        resolved: false,
        replies: [],
      });
    }
  }

  // Unwrap span tags for any resolved comments (<span data-comment-id="id">text</span> -> text)
  threads.forEach((thread) => {
    if (thread.resolved) {
      const safeId = thread.id.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const resolvedSpanRegex = new RegExp(
        `<span\\s+data-comment-id="${safeId}">([\\s\\S]*?)<\\/span>`,
        'g'
      );
      cleanMarkdown = cleanMarkdown.replace(resolvedSpanRegex, '$1');
    }
  });

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
