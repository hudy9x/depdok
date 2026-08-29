import { SpreadsheetSDK } from "@/features/PreviewXlsx/core/spreadsheetSdk";
import { CellStyle, CellValue } from "@/features/PreviewXlsx/core/types";
import { loadWorkbookFromPath } from "./sheetHelper";

export interface SheetGetCellArgs {
  path?: string;
  sheet?: string;
  cell: string;
}

export interface SheetGetCellResult {
  path: string;
  fileName: string;
  sheet: string;
  cell: string;
  rawValue: CellValue;
  calculatedValue: CellValue;
  formula?: string;
  formattedText: string;
  style?: CellStyle;
  numFmt?: string;
}

export async function sheetGetCellTool(args: SheetGetCellArgs): Promise<SheetGetCellResult> {
  if (!args.cell || !args.cell.trim()) {
    throw new Error("Missing required 'cell' parameter (e.g. 'A1', 'C12').");
  }

  const { fullPath, fileName, workbook } = await loadWorkbookFromPath(args.path);
  const targetSheet = args.sheet || workbook.activeSheet || workbook.sheetNames[0];

  if (!workbook.sheets[targetSheet]) {
    throw new Error(`Sheet '${targetSheet}' not found in workbook '${fileName}'. Available sheets: ${workbook.sheetNames.join(", ")}`);
  }

  const upperCell = args.cell.trim().toUpperCase();
  const info = SpreadsheetSDK.getCellValue(workbook, targetSheet, upperCell);

  return {
    path: fullPath,
    fileName,
    sheet: targetSheet,
    cell: upperCell,
    rawValue: info.rawValue,
    calculatedValue: info.calculatedValue,
    formula: info.formula,
    formattedText: info.formattedText,
    style: info.style,
    numFmt: info.numFmt,
  };
}
