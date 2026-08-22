import { getDefaultStore } from "jotai";
import { toast } from "sonner";
import { listDirectory, FileEntry } from "@/features/FileExplorer/api";
import { workspaceRootAtom } from "@/features/FileExplorer/store";
import { resolveTargetFilePath } from "../common/pathHelper";

export interface ListFilesArgs {
  path?: string;
  recursive?: boolean;
  max_depth?: number;
  include_hidden?: boolean;
}

export interface ListFilesResult {
  success: boolean;
  targetFolder: string;
  totalFiles: number;
  totalFolders: number;
  folders: string[];
  files: string[];
  message: string;
}

const IGNORED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "target",
  "dist",
  ".system_generated",
  ".gemini",
  ".next",
  "build",
]);

export async function listFilesTool(args: ListFilesArgs): Promise<ListFilesResult> {
  const store = getDefaultStore();
  const workspaceRoot = store.get(workspaceRootAtom) || "";

  // Target directory resolution: defaults to workspace root if omitted
  let targetDir = args.path ? resolveTargetFilePath(args.path) : workspaceRoot;
  if (!targetDir) {
    targetDir = workspaceRoot;
  }

  const isRecursive = args.recursive ?? false;
  const maxDepth = typeof args.max_depth === "number" ? Math.max(1, Math.min(args.max_depth, 10)) : 4;
  const includeHidden = args.include_hidden ?? false;

  const folderList: string[] = [];
  const fileList: string[] = [];

  async function traverse(currentDir: string, currentDepth: number): Promise<void> {
    try {
      const rawEntries: FileEntry[] = await listDirectory(currentDir);

      for (const entry of rawEntries) {
        const isHidden = entry.name.startsWith(".");
        if (isHidden && !includeHidden) {
          continue;
        }

        if (entry.is_dir && IGNORED_DIRECTORIES.has(entry.name) && !includeHidden) {
          continue;
        }

        const relativePath = entry.path.startsWith(targetDir)
          ? entry.path.slice(targetDir.length).replace(/^[/\\]+/, "")
          : entry.name;

        if (entry.is_dir) {
          folderList.push(relativePath);
          if (isRecursive && currentDepth < maxDepth) {
            await traverse(entry.path, currentDepth + 1);
          }
        } else {
          fileList.push(relativePath);
        }
      }
    } catch (err) {
      console.warn(`[listFilesTool] Failed to list directory '${currentDir}':`, err);
    }
  }

  try {
    await traverse(targetDir, 1);
    const dirName = targetDir.split(/[/\\]/).pop() || targetDir || "workspace";

    toast.info(`Found ${fileList.length} file(s) and ${folderList.length} folder(s) in '${dirName}'`);

    return {
      success: true,
      targetFolder: dirName,
      totalFiles: fileList.length,
      totalFolders: folderList.length,
      folders: folderList,
      files: fileList,
      message: `Listed ${fileList.length} file(s) and ${folderList.length} folder(s) in '${dirName}'${isRecursive ? ` (recursive up to depth ${maxDepth})` : ""}.`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    toast.error(`Failed to list files: ${errorMsg}`);
    throw new Error(`Failed to list files in '${targetDir}': ${errorMsg}`);
  }
}

