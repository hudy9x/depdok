import { toast } from "sonner";
import { SpreadsheetSDK } from "@/features/PreviewXlsx/core/spreadsheetSdk";
import { BorderLineStyle, BorderType, CellStyle } from "@/features/PreviewXlsx/core/types";
import { loadWorkbookFromPath, saveWorkbookToPath } from "./sheetHelper";

export interface SheetFormatRangeArgs {
  path?: string;
  sheet?: string;
  range: string;
  // Background color
  bgColor?: string;
  bg_color?: string;
  // Border settings
  border?: {
    borderType?: BorderType;
    border_type?: BorderType;
    type?: BorderType;
    color?: string;
    style?: BorderLineStyle;
  };
  borderType?: BorderType;
  border_type?: BorderType;
  borderColor?: string;
  border_color?: string;
  borderStyle?: BorderLineStyle;
  border_style?: BorderLineStyle;
  // Optional simple styling
  style?: Partial<CellStyle>;
  bold?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right';
  num_fmt?: string;
  numFmt?: string;
}

export interface SheetFormatRangeResult {
  path: string;
  fileName: string;
  sheet: string;
  range: string;
  appliedFormatting: {
    background: boolean;
    border: boolean;
  };
}

export async function sheetFormatRangeTool(args: SheetFormatRangeArgs): Promise<SheetFormatRangeResult> {
  if (!args.range || !args.range.trim()) {
    throw new Error("Missing required 'range' parameter (e.g. 'A1:D1', 'B2').");
  }

  const { fullPath, fileName, workbook } = await loadWorkbookFromPath(args.path);
  const targetSheet = args.sheet || workbook.activeSheet || workbook.sheetNames[0];

  if (!workbook.sheets[targetSheet]) {
    throw new Error(
      `Sheet '${targetSheet}' not found in workbook '${fileName}'. Available sheets: ${workbook.sheetNames.join(", ")}`
    );
  }

  const upperRange = args.range.trim().toUpperCase();
  let currentWb = workbook;

  let appliedBg = false;
  let appliedBorder = false;

  // 1. Background color & basic text styles
  const bgColor = args.bgColor || args.bg_color || args.style?.bgColor;
  const styleObj: Partial<CellStyle> = { ...(args.style || {}) };
  if (bgColor) styleObj.bgColor = bgColor;
  if (args.bold !== undefined) styleObj.bold = args.bold;
  if (args.color) styleObj.color = args.color;
  if (args.align) styleObj.align = args.align;

  if (Object.keys(styleObj).length > 0) {
    const { workbook: nextWb, result } = SpreadsheetSDK.executeCommand(currentWb, {
      type: "SET_CELL_STYLE",
      sheet: targetSheet,
      range: upperRange,
      style: styleObj,
    });
    if (!result.success) {
      throw new Error(result.message || "Failed to set cell style.");
    }
    currentWb = nextWb;
    appliedBg = true;
  }

  // 2. Number format (optional)
  const numFmt = args.numFmt || args.num_fmt;
  if (numFmt) {
    const { workbook: nextWb, result } = SpreadsheetSDK.executeCommand(currentWb, {
      type: "SET_CELL_FORMAT",
      sheet: targetSheet,
      range: upperRange,
      numFmt,
    });
    if (result.success) currentWb = nextWb;
  }

  // 3. Border formatting (matching the toolbar border button)
  const borderObj = args.border;
  const borderType = borderObj?.borderType || borderObj?.border_type || borderObj?.type || args.borderType || args.border_type;
  if (borderObj || borderType) {
    const typeVal: BorderType = borderType || 'all';
    const colorVal = borderObj?.color || args.borderColor || args.border_color;
    const styleVal = borderObj?.style || args.borderStyle || args.border_style || 'thin';

    const { workbook: nextWb, result } = SpreadsheetSDK.executeCommand(currentWb, {
      type: "APPLY_BORDER",
      sheet: targetSheet,
      range: upperRange,
      borderType: typeVal,
      color: colorVal,
      style: styleVal,
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
      background: appliedBg,
      border: appliedBorder,
    },
  };
}
