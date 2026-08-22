import { getDefaultStore } from "jotai";
import { writeFileContent } from "@/features/FileExplorer/api";
import { refreshDirectoryAtom } from "@/features/FileExplorer/store";
import { resolveTargetFilePath, getParentDir } from "../common/pathHelper";

export interface UpsertMarkdownArgs {
  path?: string;
  content: string;
}

export interface UpsertMarkdownResult {
  success: boolean;
  path: string;
  fileName: string;
  wordCount: number;
  message: string;
}

export async function upsertMarkdownTool(args: UpsertMarkdownArgs): Promise<UpsertMarkdownResult> {
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

    return {
      success: true,
      path: fullPath,
      fileName,
      wordCount: words,
      message: `Markdown file '${fileName}' upserted successfully (${words} words).`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to upsert markdown file '${fullPath}': ${errorMsg}`);
  }
}
