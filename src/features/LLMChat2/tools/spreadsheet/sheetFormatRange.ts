import { toast } from "sonner";
import { SpreadsheetSDK } from "@/features/PreviewXlsx/core/spreadsheetSdk";
import { BorderLineStyle, BorderType, CellStyle } from "@/features/PreviewXlsx/core/types";
import { loadWorkbookFromPath, saveWorkbookToPath } from "./sheetHelper";

export interface SheetFormatRangeArgs {
  path?: string;
  sheet?: string;
  range: string;
  style?: Partial<CellStyle>;
  numFmt?: string;
  num_fmt?: string;
  border?: {
    borderType: BorderType;
    color?: string;
    style?: BorderLineStyle;
  };
}

export interface SheetFormatRangeResult {
  path: string;
  fileName: string;
  sheet: string;
  range: string;
  appliedFormatting: {
    styles: boolean;
    numFmt: boolean;
    border: boolean;
  };
}

export async function sheetFormatRangeTool(args: SheetFormatRangeArgs): Promise<SheetFormatRangeResult> {
  if (!args.range || !args.range.trim()) {
    throw new Error("Missing required 'range' parameter (e.g. 'A1:D1').");
  }

  const { fullPath, fileName, workbook } = await loadWorkbookFromPath(args.path);
  const targetSheet = args.sheet || workbook.activeSheet || workbook.sheetNames[0];

  if (!workbook.sheets[targetSheet]) {
    throw new Error(`Sheet '${targetSheet}' not found in workbook '${fileName}'. Available sheets: ${workbook.sheetNames.join(", ")}`);
  }

  const upperRange = args.range.trim().toUpperCase();
  let currentWb = workbook;

  let appliedStyles = false;
  let appliedNumFmt = false;
  let appliedBorder = false;

  // 1. Style formatting
  if (args.style && Object.keys(args.style).length > 0) {
    const { workbook: nextWb, result } = SpreadsheetSDK.executeCommand(currentWb, {
      type: "SET_CELL_STYLE",
      sheet: targetSheet,
      range: upperRange,
      style: args.style,
    });
    if (!result.success) {
      throw new Error(result.message || "Failed to set cell style.");
    }
    currentWb = nextWb;
    appliedStyles = true;
  }

  // 2. Number formatting
  const numFormat = args.numFmt || args.num_fmt;
  if (numFormat) {
    const { workbook: nextWb, result } = SpreadsheetSDK.executeCommand(currentWb, {
      type: "SET_CELL_FORMAT",
      sheet: targetSheet,
      range: upperRange,
      numFmt: numFormat,
    });
    if (!result.success) {
      throw new Error(result.message || "Failed to set cell format.");
    }
    currentWb = nextWb;
    appliedNumFmt = true;
  }

  // 3. Border formatting
  if (args.border) {
    const { workbook: nextWb, result } = SpreadsheetSDK.executeCommand(currentWb, {
      type: "APPLY_BORDER",
      sheet: targetSheet,
      range: upperRange,
      borderType: args.border.borderType,
      color: args.border.color,
      style: args.border.style,
    });
    if (!result.success) {
      throw new Error(result.message || "Failed to apply border.");
    }
    currentWb = nextWb;
    appliedBorder = true;
  }

  await saveWorkbookToPath(fullPath, currentWb);
  toast.success(`Formatted ${upperRange} in ${fileName}`);

  return {
    path: fullPath,
    fileName,
    sheet: targetSheet,
    range: upperRange,
    appliedFormatting: {
      styles: appliedStyles,
      numFmt: appliedNumFmt,
      border: appliedBorder,
    },
  };
}
