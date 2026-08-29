import { SpreadsheetSDK } from "@/features/PreviewXlsx/core/spreadsheetSdk";
import { loadWorkbookFromPath } from "./sheetHelper";

export interface SheetGetDataArgs {
  path?: string;
  sheet?: string;
  range?: string;
  format?: "grid" | "table";
}

export interface SheetGetDataResult {
  path: string;
  fileName: string;
  sheet: string;
  format: "grid" | "table";
  range?: string;
  rowCount: number;
  data: any[][] | Record<string, any>[];
}

export async function sheetGetDataTool(args: SheetGetDataArgs): Promise<SheetGetDataResult> {
  const { fullPath, fileName, workbook } = await loadWorkbookFromPath(args.path);
  const targetSheet = args.sheet || workbook.activeSheet || workbook.sheetNames[0];

  if (!workbook.sheets[targetSheet]) {
    throw new Error(`Sheet '${targetSheet}' not found in workbook '${fileName}'. Available sheets: ${workbook.sheetNames.join(", ")}`);
  }

  const format = args.format || (args.range ? "grid" : "table");

  let data: any[][] | Record<string, any>[];

  if (format === "grid") {
    if (args.range) {
      data = SpreadsheetSDK.getRangeData(workbook, targetSheet, args.range);
    } else {
      const sheetModel = workbook.sheets[targetSheet];
      const maxCol = Math.min(sheetModel.colCount, 26);
      const maxRow = Math.min(sheetModel.rowCount, 100);
      const lastColChar = String.fromCharCode(65 + Math.max(0, maxCol - 1));
      const fallbackRange = `A1:${lastColChar}${maxRow}`;
      data = SpreadsheetSDK.getRangeData(workbook, targetSheet, fallbackRange);
    }
  } else {
    data = SpreadsheetSDK.getSheetTable(workbook, targetSheet);
  }

  return {
    path: fullPath,
    fileName,
    sheet: targetSheet,
    format,
    range: args.range,
    rowCount: data.length,
    data,
  };
}
