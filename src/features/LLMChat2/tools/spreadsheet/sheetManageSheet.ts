import { toast } from "sonner";
import { SpreadsheetSDK } from "@/features/PreviewXlsx/core/spreadsheetSdk";
import { SpreadsheetCommand } from "@/features/PreviewXlsx/core/types";
import { loadWorkbookFromPath, saveWorkbookToPath } from "./sheetHelper";

export interface SheetManageSheetArgs {
  path?: string;
  action: "add" | "delete" | "rename" | "duplicate" | "set_active";
  sheetName?: string;
  sheet_name?: string;
  newName?: string;
  new_name?: string;
}

export interface SheetManageSheetResult {
  path: string;
  fileName: string;
  action: string;
  activeSheet: string;
  sheetNames: string[];
}

export async function sheetManageSheetTool(args: SheetManageSheetArgs): Promise<SheetManageSheetResult> {
  const { fullPath, fileName, workbook } = await loadWorkbookFromPath(args.path);

  const sheetName = args.sheetName || args.sheet_name;
  const newName = args.newName || args.new_name;

  let command: SpreadsheetCommand;

  switch (args.action) {
    case "add":
      command = { type: "ADD_SHEET", name: sheetName || newName };
      break;
    case "delete":
      if (!sheetName) {
        throw new Error("Missing required 'sheet_name' / 'sheetName' to delete.");
      }
      command = { type: "DELETE_SHEET", name: sheetName };
      break;
    case "rename":
      if (!sheetName || !newName) {
        throw new Error("Renaming requires both 'sheet_name' / 'sheetName' (current) and 'new_name' / 'newName'.");
      }
      command = { type: "RENAME_SHEET", oldName: sheetName, newName: newName };
      break;
    case "duplicate":
      command = { type: "DUPLICATE_SHEET", name: sheetName || workbook.activeSheet };
      break;
    case "set_active":
      if (!sheetName) {
        throw new Error("Missing required 'sheet_name' / 'sheetName' to set as active.");
      }
      command = { type: "SET_ACTIVE_SHEET", name: sheetName };
      break;
    default:
      throw new Error(`Unsupported action '${args.action}'. Supported: add, delete, rename, duplicate, set_active`);
  }

  const { workbook: nextWb, result } = SpreadsheetSDK.executeCommand(workbook, command);

  if (!result.success) {
    throw new Error(result.message || `Failed to perform ${args.action} sheet.`);
  }

  await saveWorkbookToPath(fullPath, nextWb);
  toast.success(`Sheet ${args.action} succeeded in ${fileName}`);

  return {
    path: fullPath,
    fileName,
    action: args.action,
    activeSheet: nextWb.activeSheet,
    sheetNames: nextWb.sheetNames,
  };
}
