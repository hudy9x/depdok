import { getDefaultStore } from "jotai";
import { toast } from "sonner";
import { renameNode } from "@/features/FileExplorer/api";
import { refreshDirectoryAtom } from "@/features/FileExplorer/store";
import { updateTabsPathByPrefixAtom } from "@/stores/TabStore";
import { resolvePath, getParentDir } from "../common/pathHelper";

export interface RenameFolderArgs {
  old_path: string;
  new_name: string;
}

export interface RenameFolderResult {
  success: boolean;
  oldPath: string;
  newPath: string;
  message: string;
}

export async function renameFolderTool(args: RenameFolderArgs): Promise<RenameFolderResult> {
  const fullOldPath = resolvePath(args.old_path);
  const parentDir = getParentDir(fullOldPath);
  const fullNewPath = args.new_name.includes("/") || args.new_name.includes("\\")
    ? resolvePath(args.new_name)
    : `${parentDir}/${args.new_name}`;

  const oldFolderName = fullOldPath.split(/[/\\]/).pop() || fullOldPath;
  const newFolderName = fullNewPath.split(/[/\\]/).pop() || fullNewPath;

  try {
    await renameNode(fullOldPath, fullNewPath);

    const store = getDefaultStore();

    // Update open tabs that have this folder as prefix
    await store.set(updateTabsPathByPrefixAtom, {
      fromPath: fullOldPath,
      toPath: fullNewPath,
    });

    // Refresh file tree
    if (parentDir) {
      await store.set(refreshDirectoryAtom, parentDir);
    }

    toast.success(`Renamed folder: ${oldFolderName} -> ${newFolderName}`);

    return {
      success: true,
      oldPath: fullOldPath,
      newPath: fullNewPath,
      message: `Folder renamed successfully from '${oldFolderName}' to '${newFolderName}'`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    toast.error(`Failed to rename folder: ${errorMsg}`);
    throw new Error(`Failed to rename folder '${fullOldPath}': ${errorMsg}`);
  }
}
