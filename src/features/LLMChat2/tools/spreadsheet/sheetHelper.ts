import { getDefaultStore } from "jotai";
import { readBinaryFile, writeBinaryFile } from "@/lib/fileOperations";
import { SpreadsheetSDK } from "@/features/PreviewXlsx/core/spreadsheetSdk";
import { WorkbookModel } from "@/features/PreviewXlsx/core/types";
import { liveFilesContentAtom } from "@/stores/EditorStore";
import { refreshDirectoryAtom } from "@/features/FileExplorer/store";
import { activeTabAtom, isDummyPath } from "@/stores/TabStore";
import { getParentDir, resolvePath } from "../common/pathHelper";

export interface LoadedSpreadsheet {
  fullPath: string;
  fileName: string;
  workbook: WorkbookModel;
}

/**
 * Resolves target spreadsheet path. Falls back to currently active tab if path is omitted or refers to active.
 */
export function resolveSpreadsheetPath(inputPath?: string): string {
  const store = getDefaultStore();
  const cleanInput = inputPath ? inputPath.trim() : "";
  const lower = cleanInput.toLowerCase();

  const isExplicitActive =
    !cleanInput ||
    lower === "active" ||
    lower === "current" ||
    lower === "this" ||
    lower === "open" ||
    lower.startsWith("active") ||
    lower.startsWith("current") ||
    lower.includes("active document") ||
    lower.includes("active sheet") ||
    lower.includes("active spreadsheet") ||
    lower.includes("current document") ||
    lower.includes("current spreadsheet") ||
    lower.includes("current tab");

  if (isExplicitActive) {
    const activeTab = store.get(activeTabAtom);
    if (activeTab && activeTab.filePath && !isDummyPath(activeTab.filePath)) {
      const ext = activeTab.filePath.split(".").pop()?.toLowerCase() || "";
      if (["xlsx", "xls", "csv"].includes(ext)) {
        return activeTab.filePath;
      }
    }
  }

  return resolvePath(cleanInput);
}

/**
 * Loads a workbook model from disk or active live cache.
 */
export async function loadWorkbookFromPath(path?: string): Promise<LoadedSpreadsheet> {
  const fullPath = resolveSpreadsheetPath(path);
  if (!fullPath) {
    throw new Error("No spreadsheet path specified and no active spreadsheet document is currently open.");
  }

  const fileName = fullPath.split(/[/\\]/).pop() || fullPath;
  const store = getDefaultStore();
  const liveContent = store.get(liveFilesContentAtom)[fullPath];

  try {
    let workbook: WorkbookModel;

    if (liveContent && liveContent.trim().length > 0) {
      workbook = SpreadsheetSDK.loadWorkbook(liveContent);
    } else {
      const bytes = await readBinaryFile(fullPath);
      workbook = SpreadsheetSDK.loadWorkbook(bytes);
    }

    return {
      fullPath,
      fileName,
      workbook,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load spreadsheet from '${fullPath}': ${errorMsg}`);
  }
}

/**
 * Saves a workbook model to disk and synchronizes active editor state.
 */
export async function saveWorkbookToPath(fullPath: string, workbook: WorkbookModel): Promise<void> {
  const evaluatedWb = SpreadsheetSDK.evaluateAll(workbook);
  const bytes = SpreadsheetSDK.toBinary(evaluatedWb);
  const base64 = SpreadsheetSDK.toBase64(evaluatedWb);

  await writeBinaryFile(fullPath, bytes);

  const store = getDefaultStore();

  // Update live content cache so active editor panes re-render immediately
  store.set(liveFilesContentAtom, (prev) => ({
    ...prev,
    [fullPath]: base64,
  }));

  // Trigger file tree refresh
  const parentDir = getParentDir(fullPath);
  if (parentDir) {
    store.set(refreshDirectoryAtom, parentDir);
  }
}
