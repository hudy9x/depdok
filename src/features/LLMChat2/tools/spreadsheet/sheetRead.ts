import { SpreadsheetSDK } from "@/features/PreviewXlsx/core/spreadsheetSdk";
import { loadWorkbookFromPath } from "./sheetHelper";

export interface SheetReadArgs {
  path?: string;
}

export interface SheetSummaryItem {
  name: string;
  cellCount: number;
  rowCount: number;
  colCount: number;
  preview: any[][];
}

export interface SheetReadResult {
  path: string;
  fileName: string;
  activeSheet: string;
  totalSheets: number;
  sheets: SheetSummaryItem[];
}

export async function sheetReadTool(args: SheetReadArgs): Promise<SheetReadResult> {
  const { fullPath, fileName, workbook } = await loadWorkbookFromPath(args.path);
  const summary = SpreadsheetSDK.getWorkbookSummary(workbook);

  return {
    path: fullPath,
    fileName,
    activeSheet: summary.activeSheet,
    totalSheets: summary.sheets.length,
    sheets: summary.sheets,
  };
}
