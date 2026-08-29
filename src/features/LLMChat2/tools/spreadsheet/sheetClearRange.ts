import { toast } from "sonner";
import { SpreadsheetSDK } from "@/features/PreviewXlsx/core/spreadsheetSdk";
import { loadWorkbookFromPath, saveWorkbookToPath } from "./sheetHelper";

export interface SheetClearRangeArgs {
  path?: string;
  sheet?: string;
  range: string;
  clearStyles?: boolean;
  clear_styles?: boolean;
}

export interface SheetClearRangeResult {
  path: string;
  fileName: string;
  sheet: string;
  range: string;
  clearedCellsCount: number;
}

export async function sheetClearRangeTool(args: SheetClearRangeArgs): Promise<SheetClearRangeResult> {
  if (!args.range || !args.range.trim()) {
    throw new Error("Missing required 'range' parameter (e.g. 'A1:C10').");
  }

  const { fullPath, fileName, workbook } = await loadWorkbookFromPath(args.path);
  const targetSheet = args.sheet || workbook.activeSheet || workbook.sheetNames[0];

  if (!workbook.sheets[targetSheet]) {
    throw new Error(`Sheet '${targetSheet}' not found in workbook '${fileName}'. Available sheets: ${workbook.sheetNames.join(", ")}`);
  }

  const upperRange = args.range.trim().toUpperCase();

  const { workbook: nextWb, result } = SpreadsheetSDK.executeCommand(workbook, {
    type: "CLEAR_RANGE",
    sheet: targetSheet,
    range: upperRange,
    clearStyles: Boolean(args.clearStyles ?? args.clear_styles),
  });

  if (!result.success) {
    throw new Error(result.message || `Failed to clear range ${upperRange}.`);
  }

  await saveWorkbookToPath(fullPath, nextWb);
  toast.success(`Cleared ${upperRange} in ${fileName}`);

  return {
    path: fullPath,
    fileName,
    sheet: targetSheet,
    range: upperRange,
    clearedCellsCount: result.modifiedCells.length,
  };
}
