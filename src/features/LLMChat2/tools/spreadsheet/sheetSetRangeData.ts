import { toast } from "sonner";
import { SpreadsheetSDK } from "@/features/PreviewXlsx/core/spreadsheetSdk";
import { loadWorkbookFromPath, saveWorkbookToPath } from "./sheetHelper";

export interface SheetSetRangeDataArgs {
  path?: string;
  sheet?: string;
  startCell?: string;
  start_cell?: string;
  data: any[][];
}

export interface SheetSetRangeDataResult {
  path: string;
  fileName: string;
  sheet: string;
  startCell: string;
  rowsWritten: number;
  colsWritten: number;
  cellsUpdated: number;
}

export async function sheetSetRangeDataTool(args: SheetSetRangeDataArgs): Promise<SheetSetRangeDataResult> {
  const startCellRaw = args.startCell || args.start_cell;
  if (!startCellRaw || !startCellRaw.trim()) {
    throw new Error("Missing required 'start_cell' / 'startCell' parameter (e.g. 'A1').");
  }
  if (!args.data || !Array.isArray(args.data) || args.data.length === 0) {
    throw new Error("Missing or invalid 'data' parameter (must be a 2D array of values).");
  }

  const { fullPath, fileName, workbook } = await loadWorkbookFromPath(args.path);
  const targetSheet = args.sheet || workbook.activeSheet || workbook.sheetNames[0];

  if (!workbook.sheets[targetSheet]) {
    throw new Error(`Sheet '${targetSheet}' not found in workbook '${fileName}'. Available sheets: ${workbook.sheetNames.join(", ")}`);
  }

  const upperStart = startCellRaw.trim().toUpperCase();

  const { workbook: nextWb, result } = SpreadsheetSDK.executeCommand(workbook, {
    type: "SET_RANGE_DATA",
    sheet: targetSheet,
    startCell: upperStart,
    data: args.data,
  });

  if (!result.success) {
    throw new Error(result.message || "Failed to set range data.");
  }

  await saveWorkbookToPath(fullPath, nextWb);

  const rowsWritten = args.data.length;
  const colsWritten = Math.max(...args.data.map((r) => (Array.isArray(r) ? r.length : 0)), 0);

  toast.success(`Updated ${result.modifiedCells.length} cells in ${fileName} [${targetSheet}]`);

  return {
    path: fullPath,
    fileName,
    sheet: targetSheet,
    startCell: upperStart,
    rowsWritten,
    colsWritten,
    cellsUpdated: result.modifiedCells.length,
  };
}
