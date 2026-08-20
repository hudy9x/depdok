import { getDefaultStore } from "jotai";
import { toast } from "sonner";
import { renameNode } from "@/features/FileExplorer/api";
import { refreshDirectoryAtom } from "@/features/FileExplorer/store";
import { tabsAtom } from "@/stores/TabStore";
import { resolvePath, getParentDir } from "./pathHelper";

export interface RenameFolderArgs {
  old_path: string;
  new_name: string;
}

export interface RenameFolderResult {
  success: boolean;
  old_path: string;
  new_path: string;
  message: string;
}

export async function renameFolderTool(args: RenameFolderArgs): Promise<RenameFolderResult> {
  const oldFullPath = resolvePath(args.old_path);
  const parentDir = getParentDir(oldFullPath);

  const newFullPath = args.new_name.includes("/") || args.new_name.includes("\\")
    ? resolvePath(args.new_name)
    : `${parentDir}/${args.new_name}`;

  const newFolderName = newFullPath.split(/[/\\]/).pop() || args.new_name;

  try {
    await renameNode(oldFullPath, newFullPath);

    const store = getDefaultStore();

    // Update open tabs that were inside this folder
    const currentTabs = store.get(tabsAtom);
    const prefixOld = `${oldFullPath}/`;
    const prefixNew = `${newFullPath}/`;

    store.set(
      tabsAtom,
      currentTabs.map((t) => {
        if (t.filePath.startsWith(prefixOld)) {
          const updatedPath = prefixNew + t.filePath.slice(prefixOld.length);
          return { ...t, filePath: updatedPath };
        }
        return t;
      })
    );

    if (parentDir) {
      await store.set(refreshDirectoryAtom, parentDir);
    }

    toast.success(`Renamed folder to ${newFolderName}`);

    return {
      success: true,
      old_path: oldFullPath,
      new_path: newFullPath,
      message: `Folder renamed successfully from '${oldFullPath}' to '${newFullPath}'`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    toast.error(`Failed to rename folder: ${errorMsg}`);
    throw new Error(`Failed to rename folder '${oldFullPath}': ${errorMsg}`);
  }
}
