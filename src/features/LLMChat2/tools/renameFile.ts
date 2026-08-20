import { getDefaultStore } from "jotai";
import { toast } from "sonner";
import { renameNode } from "@/features/FileExplorer/api";
import { refreshDirectoryAtom } from "@/features/FileExplorer/store";
import { tabsAtom } from "@/stores/TabStore";
import { resolvePath, getParentDir } from "./pathHelper";

export interface RenameFileArgs {
  old_path: string;
  new_name: string;
}

export interface RenameFileResult {
  success: boolean;
  old_path: string;
  new_path: string;
  message: string;
}

export async function renameFileTool(args: RenameFileArgs): Promise<RenameFileResult> {
  const oldFullPath = resolvePath(args.old_path);
  const parentDir = getParentDir(oldFullPath);

  // If new_name is just a file name, prepend parent directory
  const newFullPath = args.new_name.includes("/") || args.new_name.includes("\\")
    ? resolvePath(args.new_name)
    : `${parentDir}/${args.new_name}`;

  const newFileName = newFullPath.split(/[/\\]/).pop() || args.new_name;

  try {
    await renameNode(oldFullPath, newFullPath);

    const store = getDefaultStore();

    // Update active open tabs if matching
    const currentTabs = store.get(tabsAtom);
    const tabToUpdate = currentTabs.find((t) => t.filePath === oldFullPath);
    if (tabToUpdate) {
      const newExtension = newFileName.includes(".")
        ? newFileName.split(".").pop() || null
        : null;

      store.set(
        tabsAtom,
        currentTabs.map((t) =>
          t.id === tabToUpdate.id
            ? {
                ...t,
                filePath: newFullPath,
                fileName: newFileName,
                fileExtension: newExtension,
              }
            : t
        )
      );
    }

    if (parentDir) {
      await store.set(refreshDirectoryAtom, parentDir);
    }

    toast.success(`Renamed file to ${newFileName}`);

    return {
      success: true,
      old_path: oldFullPath,
      new_path: newFullPath,
      message: `File renamed successfully from '${oldFullPath}' to '${newFullPath}'`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    toast.error(`Failed to rename file: ${errorMsg}`);
    throw new Error(`Failed to rename file '${oldFullPath}': ${errorMsg}`);
  }
}
