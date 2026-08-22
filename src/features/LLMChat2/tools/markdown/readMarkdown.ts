import { toast } from "sonner";
import { readFileContent } from "@/features/FileExplorer/api";
import { extractComments } from "@/features/PreviewMarkdown/extensions/comment/commentParser";
import { resolveTargetFilePath } from "../common/pathHelper";

export interface ReadMarkdownArgs {
  path?: string;
}

export interface MarkdownHeading {
  level: number;
  text: string;
}

export interface ReadMarkdownResult {
  path: string;
  fileName: string;
  content: string;
  wordCount: number;
  lineCount: number;
  headings: MarkdownHeading[];
  commentsCount: number;
  comments: Array<{
    id: string;
    text: string;
    author: string;
    resolved: boolean;
  }>;
}

export async function readMarkdownTool(args: ReadMarkdownArgs): Promise<ReadMarkdownResult> {
  const fullPath = resolveTargetFilePath(args.path);
  if (!fullPath) {
    throw new Error("No file path specified and no active markdown document is currently open.");
  }

  const fileName = fullPath.split(/[/\\]/).pop() || fullPath;

  try {
    const rawContent = await readFileContent(fullPath);
    const { cleanMarkdown, threads } = extractComments(rawContent);

    // Extract headings outline
    const headings: MarkdownHeading[] = [];
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    let match: RegExpExecArray | null;
    while ((match = headingRegex.exec(cleanMarkdown)) !== null) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
      });
    }

    const lines = cleanMarkdown.split("\n").length;
    const words = cleanMarkdown.trim().split(/\s+/).filter(Boolean).length;

    toast.info(`Read markdown: ${fileName} (${words} words)`);

    return {
      path: fullPath,
      fileName,
      content: cleanMarkdown,
      wordCount: words,
      lineCount: lines,
      headings,
      commentsCount: threads.length,
      comments: threads.map((t) => ({
        id: t.id,
        text: t.text,
        author: t.author,
        resolved: t.resolved,
      })),
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    toast.error(`Failed to read markdown: ${errorMsg}`);
    throw new Error(`Failed to read markdown file '${fullPath}': ${errorMsg}`);
  }
}
