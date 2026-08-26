import { getDefaultStore } from "jotai";
import { readFileContent, writeFileContent } from "@/features/FileExplorer/api";
import {
  extractComments,
  appendComments,
  generateCommentId,
} from "@/features/PreviewMarkdown/extensions/comment/commentParser";
import {
  addCommentThreadAtom,
  CommentThread,
} from "@/features/PreviewMarkdown/extensions/comment/commentStore";
import { resolveTargetFilePath } from "../common/pathHelper";

export interface AddMarkdownCommentArgs {
  path?: string;
  target_text: string;
  comment: string;
  author?: string;
}

export interface AddMarkdownCommentResult {
  success: boolean;
  path: string;
  fileName: string;
  commentId: string;
  author: string;
  target_text: string;
  comment: string;
  message: string;
}

export async function addMarkdownCommentTool(
  args: AddMarkdownCommentArgs
): Promise<AddMarkdownCommentResult> {
  const fullPath = resolveTargetFilePath(args.path);
  if (!fullPath) {
    throw new Error("No file path specified and no active markdown document is currently open.");
  }

  const fileName = fullPath.split(/[/\\]/).pop() || fullPath;
  const author = args.author?.trim() || "AI Assistant";

  if (!args.target_text || !args.target_text.trim()) {
    throw new Error("Target text snippet is required to attach an inline comment.");
  }

  if (!args.comment || !args.comment.trim()) {
    throw new Error("Comment text cannot be empty.");
  }

  try {
    const rawContent = await readFileContent(fullPath);
    const { cleanMarkdown, threads } = extractComments(rawContent);

    // Locate target text snippet in clean markdown
    if (!cleanMarkdown.includes(args.target_text)) {
      throw new Error(
        `Target text "${args.target_text}" was not found in '${fileName}'. Please verify exact phrasing using 'read_markdown'.`
      );
    }

    const commentId = generateCommentId();
    const wrappedText = `<span data-comment-id="${commentId}">${args.target_text}</span>`;
    const newMarkdown = cleanMarkdown.replace(args.target_text, wrappedText);

    const newThread: CommentThread = {
      id: commentId,
      text: args.comment.trim(),
      author,
      createdAt: new Date().toISOString(),
      resolved: false,
      replies: [],
    };

    const updatedThreads = [...threads, newThread];
    const finalContent = appendComments(newMarkdown, updatedThreads);

    await writeFileContent(fullPath, finalContent);

    // Update global Jotai comment store for this file so UI reflects it immediately
    const store = getDefaultStore();
    store.set(addCommentThreadAtom, { filePath: fullPath, thread: newThread });

    return {
      success: true,
      path: fullPath,
      fileName,
      commentId,
      author,
      target_text: args.target_text,
      comment: args.comment,
      message: `Successfully added review comment to '${fileName}' on "${args.target_text}".`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to add comment to '${fullPath}': ${errorMsg}`);
  }
}
