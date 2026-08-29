import { toast } from "sonner";
import { SpreadsheetSDK } from "@/features/PreviewXlsx/core/spreadsheetSdk";
import { resolvePath } from "../common/pathHelper";
import { saveWorkbookToPath } from "./sheetHelper";

export interface SheetCreateArgs {
  path: string;
  sheetName?: string;
  sheet_name?: string;
  initialData?: any[][];
  initial_data?: any[][];
}

export interface SheetCreateResult {
  path: string;
  fileName: string;
  sheetName: string;
  rowsCreated: number;
  colsCreated: number;
}

export async function sheetCreateTool(args: SheetCreateArgs): Promise<SheetCreateResult> {
  if (!args.path || !args.path.trim()) {
    throw new Error("Missing required 'path' parameter for spreadsheet creation.");
  }

  let fullPath = resolvePath(args.path.trim());
  const ext = fullPath.split(".").pop()?.toLowerCase();
  if (!ext || !["xlsx", "xls", "csv"].includes(ext)) {
    fullPath = `${fullPath}.xlsx`;
  }

  const fileName = fullPath.split(/[/\\]/).pop() || fullPath;
  const initialSheet = (args.sheetName || args.sheet_name)?.trim() || "Sheet1";

  let workbook = SpreadsheetSDK.createWorkbook(initialSheet);

  let rowsCount = 0;
  let colsCount = 0;
  const dataToInsert = args.initialData || args.initial_data;

  if (dataToInsert && Array.isArray(dataToInsert) && dataToInsert.length > 0) {
    const { workbook: updatedWb } = SpreadsheetSDK.executeCommand(workbook, {
      type: "SET_RANGE_DATA",
      sheet: initialSheet,
      startCell: "A1",
      data: dataToInsert,
    });
    workbook = updatedWb;
    rowsCount = dataToInsert.length;
    colsCount = Math.max(...dataToInsert.map((row) => (Array.isArray(row) ? row.length : 0)), 0);
  }

  await saveWorkbookToPath(fullPath, workbook);
  toast.success(`Created spreadsheet '${fileName}'`);

  return {
    path: fullPath,
    fileName,
    sheetName: initialSheet,
    rowsCreated: rowsCount,
    colsCreated: colsCount,
  };
}
