import { getDefaultStore } from "jotai";
import { toast } from "sonner";
import { deleteNode } from "@/features/FileExplorer/api";
import { refreshDirectoryAtom } from "@/features/FileExplorer/store";
import { markTabsDeletedByPrefixAtom } from "@/stores/TabStore";
import { resolvePath, getParentDir } from "../common/pathHelper";

export interface DeleteFileOrFolderArgs {
  path: string;
}

export interface DeleteFileOrFolderResult {
  success: boolean;
  path: string;
  message: string;
}

export async function deleteFileOrFolderTool(
  args: DeleteFileOrFolderArgs
): Promise<DeleteFileOrFolderResult> {
  const fullPath = resolvePath(args.path);
  const name = fullPath.split(/[/\\]/).pop() || fullPath;
  const parentDir = getParentDir(fullPath);

  try {
    await deleteNode(fullPath);

    const store = getDefaultStore();

    // Mark tabs deleted
    await store.set(markTabsDeletedByPrefixAtom, fullPath);

    // Refresh file tree
    if (parentDir) {
      await store.set(refreshDirectoryAtom, parentDir);
    }

    toast.success(`Deleted: ${name}`);

    return {
      success: true,
      path: fullPath,
      message: `Successfully deleted '${name}' at ${fullPath}`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    toast.error(`Failed to delete: ${errorMsg}`);
    throw new Error(`Failed to delete '${fullPath}': ${errorMsg}`);
  }
}
