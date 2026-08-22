import { getDefaultStore } from "jotai";
import { toast } from "sonner";
import { renameNode } from "@/features/FileExplorer/api";
import { refreshDirectoryAtom } from "@/features/FileExplorer/store";
import { updateTabsPathByPrefixAtom } from "@/stores/TabStore";
import { resolvePath, getParentDir } from "../common/pathHelper";

export interface RenameFileArgs {
  old_path: string;
  new_name: string;
}

export interface RenameFileResult {
  success: boolean;
  oldPath: string;
  newPath: string;
  message: string;
}

export async function renameFileTool(args: RenameFileArgs): Promise<RenameFileResult> {
  const fullOldPath = resolvePath(args.old_path);
  const parentDir = getParentDir(fullOldPath);
  const fullNewPath = args.new_name.includes("/") || args.new_name.includes("\\")
    ? resolvePath(args.new_name)
    : `${parentDir}/${args.new_name}`;

  const oldFileName = fullOldPath.split(/[/\\]/).pop() || fullOldPath;
  const newFileName = fullNewPath.split(/[/\\]/).pop() || fullNewPath;

  try {
    await renameNode(fullOldPath, fullNewPath);

    const store = getDefaultStore();

    // Update open tabs
    await store.set(updateTabsPathByPrefixAtom, {
      fromPath: fullOldPath,
      toPath: fullNewPath,
    });

    // Refresh file tree
    if (parentDir) {
      await store.set(refreshDirectoryAtom, parentDir);
    }

    toast.success(`Renamed file: ${oldFileName} -> ${newFileName}`);

    return {
      success: true,
      oldPath: fullOldPath,
      newPath: fullNewPath,
      message: `File renamed successfully from '${oldFileName}' to '${newFileName}'`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    toast.error(`Failed to rename file: ${errorMsg}`);
    throw new Error(`Failed to rename file '${fullOldPath}': ${errorMsg}`);
  }
}
