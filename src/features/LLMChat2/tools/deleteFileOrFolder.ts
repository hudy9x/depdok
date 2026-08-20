import { getDefaultStore } from "jotai";
import { toast } from "sonner";
import { deleteNode } from "@/features/FileExplorer/api";
import { refreshDirectoryAtom, workspaceRootAtom } from "@/features/FileExplorer/store";
import { tabsAtom, closeTabAtom } from "@/stores/TabStore";
import { resolvePath, getParentDir } from "./pathHelper";

export interface DeleteFileOrFolderArgs {
  path: string;
}

export interface DeleteFileOrFolderResult {
  success: boolean;
  path: string;
  message: string;
}

export async function deleteFileOrFolderTool(args: DeleteFileOrFolderArgs): Promise<DeleteFileOrFolderResult> {
  const fullPath = resolvePath(args.path);
  const itemName = fullPath.split(/[/\\]/).pop() || fullPath;
  const parentDir = getParentDir(fullPath);

  try {
    await deleteNode(fullPath);

    const store = getDefaultStore();

    // Close any tabs for deleted file or contained within deleted folder
    const currentTabs = store.get(tabsAtom);
    const closeTab = store.set;

    currentTabs.forEach((tab) => {
      if (tab.filePath === fullPath || tab.filePath.startsWith(`${fullPath}/`)) {
        closeTab(closeTabAtom, tab.id);
      }
    });

    if (parentDir) {
      await store.set(refreshDirectoryAtom, parentDir);
    }
    const workspaceRoot = store.get(workspaceRootAtom);
    if (workspaceRoot && workspaceRoot !== parentDir) {
      await store.set(refreshDirectoryAtom, workspaceRoot);
    }

    toast.success(`Deleted: ${itemName}`);

    return {
      success: true,
      path: fullPath,
      message: `Deleted '${fullPath}' successfully`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    toast.error(`Failed to delete: ${errorMsg}`);
    throw new Error(`Failed to delete '${fullPath}': ${errorMsg}`);
  }
}
