import { getDefaultStore } from "jotai";
import { toast } from "sonner";
import { createDirectory } from "@/features/FileExplorer/api";
import { refreshDirectoryAtom } from "@/features/FileExplorer/store";
import { resolvePath, getParentDir } from "./pathHelper";

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
  const folderName = fullPath.split(/[/\\]/).pop() || fullPath;
  const parentDir = getParentDir(fullPath);

  try {
    await createDirectory(fullPath);

    const store = getDefaultStore();
    if (parentDir) {
      await store.set(refreshDirectoryAtom, parentDir);
    }

    toast.success(`Created folder: ${folderName}`);

    return {
      success: true,
      path: fullPath,
      message: `Folder created successfully at ${fullPath}`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    toast.error(`Failed to create folder: ${errorMsg}`);
    throw new Error(`Failed to create folder '${fullPath}': ${errorMsg}`);
  }
}
