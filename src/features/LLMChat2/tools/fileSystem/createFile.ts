import { getDefaultStore } from "jotai";
import { createFile, writeFileContent } from "@/features/FileExplorer/api";
import { refreshDirectoryAtom } from "@/features/FileExplorer/store";
import { writeBinaryFile } from "@/lib/fileOperations";
import { SpreadsheetSDK } from "@/features/PreviewXlsx";
import { resolvePath, getParentDir } from "../common/pathHelper";

export interface CreateFileArgs {
  path: string;
  content?: string;
}

export interface CreateFileResult {
  success: boolean;
  path: string;
  message: string;
}

export async function createFileTool(args: CreateFileArgs): Promise<CreateFileResult> {
  const fullPath = resolvePath(args.path);
  const fileName = fullPath.split(/[/\\]/).pop() || fullPath;
  const parentDir = getParentDir(fullPath);

  try {
    await createFile(fullPath);

    if (args.content !== undefined && args.content !== null) {
      await writeFileContent(fullPath, args.content);
    } else if (fileName.endsWith(".excalidraw")) {
      const emptyScene = JSON.stringify({
        type: "excalidraw",
        version: 2,
        source: "depdok",
        elements: [],
        appState: { viewBackgroundColor: "#ffffff" },
        files: {},
      }, null, 2);
      await writeFileContent(fullPath, emptyScene);
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const emptyWorkbook = SpreadsheetSDK.createWorkbook();
      const bytes = await SpreadsheetSDK.toBinary(emptyWorkbook);
      await writeBinaryFile(fullPath, bytes);
    }

    const store = getDefaultStore();
    if (parentDir) {
      await store.set(refreshDirectoryAtom, parentDir);
    }

    return {
      success: true,
      path: fullPath,
      message: `File created successfully at ${fullPath}`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to create file '${fullPath}': ${errorMsg}`);
  }
}
