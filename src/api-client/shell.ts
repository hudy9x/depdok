import { invoke } from '@tauri-apps/api/core';

export interface ShellExecutionResult {
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exit_code: number;
  success: boolean;
  truncated: boolean;
  duration_ms: number;
}

export interface ExecuteShellCommandParams {
  command: string;
  cwd?: string;
  timeout_ms?: number;
}

/**
 * Execute a shell / terminal command in the workspace directory across Windows, Linux, and macOS.
 */
export const executeShellCommand = (
  params: ExecuteShellCommandParams
): Promise<ShellExecutionResult> => {
  return invoke<ShellExecutionResult>('execute_shell_command', {
    command: params.command,
    cwd: params.cwd,
    timeoutMs: params.timeout_ms,
  });
};
