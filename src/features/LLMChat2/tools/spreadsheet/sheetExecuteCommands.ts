import { toast } from "sonner";
import { SpreadsheetSDK } from "@/features/PreviewXlsx/core/spreadsheetSdk";
import { CommandExecutionResult, SpreadsheetCommand } from "@/features/PreviewXlsx/core/types";
import { loadWorkbookFromPath, saveWorkbookToPath } from "./sheetHelper";

export interface SheetExecuteCommandsArgs {
  path?: string;
  commands: SpreadsheetCommand[];
}

export interface SheetExecuteCommandsResult {
  path: string;
  fileName: string;
  commandsCount: number;
  results: CommandExecutionResult[];
}

export async function sheetExecuteCommandsTool(args: SheetExecuteCommandsArgs): Promise<SheetExecuteCommandsResult> {
  if (!args.commands || !Array.isArray(args.commands) || args.commands.length === 0) {
    throw new Error("Missing or empty 'commands' array.");
  }

  const { fullPath, fileName, workbook } = await loadWorkbookFromPath(args.path);
  const { workbook: nextWb, results } = SpreadsheetSDK.executeBatch(workbook, args.commands);

  await saveWorkbookToPath(fullPath, nextWb);
  toast.success(`Executed ${args.commands.length} commands on ${fileName}`);

  return {
    path: fullPath,
    fileName,
    commandsCount: args.commands.length,
    results,
  };
}
