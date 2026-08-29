import { toast } from "sonner";
import { SpreadsheetSDK } from "@/features/PreviewXlsx/core/spreadsheetSdk";
import { SpreadsheetCommand } from "@/features/PreviewXlsx/core/types";
import { loadWorkbookFromPath, saveWorkbookToPath } from "./sheetHelper";

export interface SheetModifyStructureArgs {
  path?: string;
  sheet?: string;
  action: "insert_row" | "delete_row" | "insert_col" | "delete_col" | "set_col_width" | "set_row_height";
  index?: number;
  rowIndex?: number;
  colIndex?: number;
  row_index?: number;
  col_index?: number;
  size?: number;
  width?: number;
  height?: number;
}

export interface SheetModifyStructureResult {
  path: string;
  fileName: string;
  sheet: string;
  action: string;
  index: number;
  rowCount: number;
  colCount: number;
}

export async function sheetModifyStructureTool(args: SheetModifyStructureArgs): Promise<SheetModifyStructureResult> {
  const rawIndex = args.index ?? args.rowIndex ?? args.row_index ?? args.colIndex ?? args.col_index;
  if (typeof rawIndex !== "number" || isNaN(rawIndex)) {
    throw new Error("Missing required numeric 'index' parameter (0-indexed).");
  }

  const { fullPath, fileName, workbook } = await loadWorkbookFromPath(args.path);
  const targetSheet = args.sheet || workbook.activeSheet || workbook.sheetNames[0];

  if (!workbook.sheets[targetSheet]) {
    throw new Error(`Sheet '${targetSheet}' not found in workbook '${fileName}'. Available sheets: ${workbook.sheetNames.join(", ")}`);
  }

  const effectiveSize = args.size ?? args.width ?? args.height;
  let command: SpreadsheetCommand;

  switch (args.action) {
    case "insert_row":
      command = { type: "INSERT_ROW", sheet: targetSheet, rowIndex: rawIndex };
      break;
    case "delete_row":
      command = { type: "DELETE_ROW", sheet: targetSheet, rowIndex: rawIndex };
      break;
    case "insert_col":
      command = { type: "INSERT_COL", sheet: targetSheet, colIndex: rawIndex };
      break;
    case "delete_col":
      command = { type: "DELETE_COL", sheet: targetSheet, colIndex: rawIndex };
      break;
    case "set_col_width":
      if (typeof effectiveSize !== "number") {
        throw new Error("Missing 'size' / 'width' (pixel width) for set_col_width.");
      }
      command = { type: "SET_COL_WIDTH", sheet: targetSheet, colIndex: rawIndex, width: effectiveSize };
      break;
    case "set_row_height":
      if (typeof effectiveSize !== "number") {
        throw new Error("Missing 'size' / 'height' (pixel height) for set_row_height.");
      }
      command = { type: "SET_ROW_HEIGHT", sheet: targetSheet, rowIndex: rawIndex, height: effectiveSize };
      break;
    default:
      throw new Error(`Unsupported structure action '${args.action}'.`);
  }

  const { workbook: nextWb, result } = SpreadsheetSDK.executeCommand(workbook, command);

  if (!result.success) {
    throw new Error(result.message || `Failed to modify structure (${args.action}).`);
  }

  await saveWorkbookToPath(fullPath, nextWb);
  const updatedSheet = nextWb.sheets[targetSheet];
  toast.success(`Structure updated (${args.action}) in ${fileName}`);

  return {
    path: fullPath,
    fileName,
    sheet: targetSheet,
    action: args.action,
    index: rawIndex,
    rowCount: updatedSheet ? updatedSheet.rowCount : 0,
    colCount: updatedSheet ? updatedSheet.colCount : 0,
  };
}
