import { getDefaultStore } from "jotai";
import { renameNode } from "@/features/FileExplorer/api";
import { refreshDirectoryAtom } from "@/features/FileExplorer/store";
import { updateTabsPathByPrefixAtom } from "@/stores/TabStore";
import { resolvePath, getParentDir } from "../common/pathHelper";

export interface MoveFilesOrFoldersArgs {
  paths: string[] | string;
  destination_folder: string;
}

export interface MovedItemDetail {
  source: string;
  destination: string;
  name: string;
  success: boolean;
  error?: string;
}

export interface MoveFilesOrFoldersResult {
  success: boolean;
  movedCount: number;
  totalCount: number;
  destinationFolder: string;
  items: MovedItemDetail[];
  message: string;
}

export async function moveFilesOrFoldersTool(
  args: MoveFilesOrFoldersArgs
): Promise<MoveFilesOrFoldersResult> {
  const rawPaths = Array.isArray(args.paths) ? args.paths : [args.paths];
  const paths = rawPaths.filter((p) => typeof p === "string" && p.trim().length > 0);

  if (paths.length === 0) {
    throw new Error("No valid source paths provided to move.");
  }

  const destFolder = resolvePath(args.destination_folder);
  const store = getDefaultStore();
  const movedItems: MovedItemDetail[] = [];
  const parentDirsToRefresh = new Set<string>();
  parentDirsToRefresh.add(destFolder);

  let successCount = 0;

  for (const rawPath of paths) {
    const fullSourcePath = resolvePath(rawPath);
    const itemName = fullSourcePath.split(/[/\\]/).pop() || fullSourcePath;
    const fullDestPath = `${destFolder.replace(/[/\\]+$/, "")}/${itemName}`;

    // Skip if source and destination are the exact same path
    if (fullSourcePath === fullDestPath) {
      movedItems.push({
        source: fullSourcePath,
        destination: fullDestPath,
        name: itemName,
        success: true,
      });
      continue;
    }

    try {
      await renameNode(fullSourcePath, fullDestPath);

      // Update open tabs if file or folder within tab was moved
      await store.set(updateTabsPathByPrefixAtom, {
        fromPath: fullSourcePath,
        toPath: fullDestPath,
      });

      const srcParent = getParentDir(fullSourcePath);
      if (srcParent) {
        parentDirsToRefresh.add(srcParent);
      }

      movedItems.push({
        source: fullSourcePath,
        destination: fullDestPath,
        name: itemName,
        success: true,
      });
      successCount++;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      movedItems.push({
        source: fullSourcePath,
        destination: fullDestPath,
        name: itemName,
        success: false,
        error: errorMsg,
      });
    }
  }

  // Refresh all affected directories in the File Explorer tree
  for (const dir of parentDirsToRefresh) {
    try {
      await store.set(refreshDirectoryAtom, dir);
    } catch (e) {
      console.error(`Failed to refresh directory: ${dir}`, e);
    }
  }

  const destFolderName = destFolder.split(/[/\\]/).pop() || destFolder;

  if (successCount === paths.length) {
    return {
      success: true,
      movedCount: successCount,
      totalCount: paths.length,
      destinationFolder: destFolder,
      items: movedItems,
      message: `Successfully moved ${successCount} item(s) to '${destFolderName}'.`,
    };
  } else if (successCount > 0) {
    return {
      success: false,
      movedCount: successCount,
      totalCount: paths.length,
      destinationFolder: destFolder,
      items: movedItems,
      message: `Partially moved ${successCount}/${paths.length} items. Some items failed.`,
    };
  } else {
    const firstError = movedItems.find((i) => i.error)?.error || "Unknown error";
    throw new Error(`Failed to move items to '${destFolder}': ${firstError}`);
  }
}
