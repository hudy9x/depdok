import { getDefaultStore } from "jotai";
import { toast } from "sonner";
import { writeFileContent } from "@/features/FileExplorer/api";
import { refreshDirectoryAtom } from "@/features/FileExplorer/store";
import { resolveTargetFilePath, getParentDir } from "../common/pathHelper";

export interface UpdateMarkdownArgs {
  path?: string;
  content: string;
}

export interface UpdateMarkdownResult {
  success: boolean;
  path: string;
  fileName: string;
  wordCount: number;
  message: string;
}

export async function updateMarkdownTool(args: UpdateMarkdownArgs): Promise<UpdateMarkdownResult> {
  const fullPath = resolveTargetFilePath(args.path);
  if (!fullPath) {
    throw new Error("No file path specified and no active markdown document is currently open.");
  }

  const fileName = fullPath.split(/[/\\]/).pop() || fullPath;
  const parentDir = getParentDir(fullPath);

  try {
    await writeFileContent(fullPath, args.content);

    const store = getDefaultStore();
    if (parentDir) {
      await store.set(refreshDirectoryAtom, parentDir);
    }

    const words = args.content.trim().split(/\s+/).filter(Boolean).length;
    toast.success(`Updated markdown: ${fileName}`);

    return {
      success: true,
      path: fullPath,
      fileName,
      wordCount: words,
      message: `Markdown file '${fileName}' updated successfully (${words} words).`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    toast.error(`Failed to update markdown: ${errorMsg}`);
    throw new Error(`Failed to update markdown file '${fullPath}': ${errorMsg}`);
  }
}
