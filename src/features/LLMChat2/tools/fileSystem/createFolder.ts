import { getDefaultStore } from "jotai";
import { createDirectory } from "@/features/FileExplorer/api";
import { refreshDirectoryAtom } from "@/features/FileExplorer/store";
import { resolvePath, getParentDir } from "../common/pathHelper";

export interface CreateFolderArgs {
  path: string;
}

export interface CreateFolderResult {
  success: boolean;
  path: string;
  message: string;
}

export async function createFolderTool(args: CreateFolderArgs): Promise<CreateFolderResult> {
  const fullPath = resolvePath(args.path);
  const parentDir = getParentDir(fullPath);

  try {
    await createDirectory(fullPath);

    const store = getDefaultStore();
    if (parentDir) {
      await store.set(refreshDirectoryAtom, parentDir);
    }

    return {
      success: true,
      path: fullPath,
      message: `Folder created successfully at ${fullPath}`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to create folder '${fullPath}': ${errorMsg}`);
  }
}
