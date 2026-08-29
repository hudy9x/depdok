import { toast } from "sonner";
import { SpreadsheetSDK } from "@/features/PreviewXlsx/core/spreadsheetSdk";
import { CellValue } from "@/features/PreviewXlsx/core/types";
import { loadWorkbookFromPath, saveWorkbookToPath } from "./sheetHelper";

export interface SheetEditCellArgs {
  path?: string;
  sheet?: string;
  cell: string;
  value: CellValue;
}

export interface SheetEditCellResult {
  path: string;
  fileName: string;
  sheet: string;
  cell: string;
  value: CellValue;
  isFormula: boolean;
  calculatedValue?: CellValue;
}

export async function sheetEditCellTool(args: SheetEditCellArgs): Promise<SheetEditCellResult> {
  if (!args.cell || !args.cell.trim()) {
    throw new Error("Missing required 'cell' parameter (e.g. 'A1', 'B5').");
  }

  const { fullPath, fileName, workbook } = await loadWorkbookFromPath(args.path);
  const targetSheet = args.sheet || workbook.activeSheet || workbook.sheetNames[0];

  if (!workbook.sheets[targetSheet]) {
    throw new Error(`Sheet '${targetSheet}' not found in workbook '${fileName}'. Available sheets: ${workbook.sheetNames.join(", ")}`);
  }

  const upperCell = args.cell.trim().toUpperCase();
  const val = args.value;
  const isFormula = typeof val === "string" && val.trim().startsWith("=");

  const command = isFormula
    ? {
        type: "SET_CELL_FORMULA" as const,
        sheet: targetSheet,
        cell: upperCell,
        formula: (val as string).trim(),
      }
    : {
        type: "SET_CELL_VALUE" as const,
        sheet: targetSheet,
        cell: upperCell,
        value: val,
      };

  const { workbook: nextWb, result } = SpreadsheetSDK.executeCommand(workbook, command);

  if (!result.success) {
    throw new Error(result.message || `Failed to edit cell ${upperCell}.`);
  }

  await saveWorkbookToPath(fullPath, nextWb);

  const cellDetails = SpreadsheetSDK.getCellValue(nextWb, targetSheet, upperCell);
  toast.success(`Updated cell ${upperCell} in ${fileName}`);

  return {
    path: fullPath,
    fileName,
    sheet: targetSheet,
    cell: upperCell,
    value: val,
    isFormula,
    calculatedValue: cellDetails.calculatedValue,
  };
}
