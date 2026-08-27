import { getDefaultStore } from "jotai";
import { toast } from "sonner";
import { executeShellCommand, ShellExecutionResult } from "@/api-client/shell";
import { workspaceRootAtom } from "@/features/FileExplorer/store";
import { resolvePath } from "../common/pathHelper";

export interface RunShellArgs {
  command: string;
  cwd?: string;
  timeout_ms?: number;
}

export type RunShellResult = ShellExecutionResult;

export async function runShellTool(args: RunShellArgs): Promise<RunShellResult> {
  const trimmedCommand = args.command?.trim();
  if (!trimmedCommand) {
    throw new Error("Command string must not be empty.");
  }

  const store = getDefaultStore();
  const workspaceRoot = store.get(workspaceRootAtom);

  let targetCwd: string | undefined;
  if (args.cwd && args.cwd.trim()) {
    targetCwd = resolvePath(args.cwd.trim());
  } else if (workspaceRoot) {
    targetCwd = workspaceRoot;
  }

  try {
    const result = await executeShellCommand({
      command: trimmedCommand,
      cwd: targetCwd,
      timeout_ms: args.timeout_ms,
    });

    if (result.success) {
      toast.success(`Executed: ${trimmedCommand}`, {
        description: `Exit code: 0 (${result.duration_ms}ms)`,
      });
    } else {
      toast.warning(`Command finished with exit code ${result.exit_code}: ${trimmedCommand}`, {
        description: result.stderr.slice(0, 100) || undefined,
      });
    }

    return result;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    toast.error(`Command failed: ${errorMsg}`);
    throw new Error(`Failed to execute shell command '${trimmedCommand}': ${errorMsg}`);
  }
}
