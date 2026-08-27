# Shell Execution Tool (`run_shell`) Architecture & Guide

This document describes the design, implementation, safety mechanisms, and usage patterns of the **Shell Execution Tool (`run_shell`)** in Depdok's LLM v2 subsystem.

---

## 1. Overview

The `run_shell` tool provides local LLM models (e.g. `qwen2.5:7b` in `LLMChat2`) with the capability to execute terminal and shell commands across all supported desktop platforms (**Windows, Linux, and macOS**).

### Primary Use Cases
- Inspecting workspace state (e.g., `git status`, `git diff`, `git log -n 5`).
- Running tests, builds, or linting (e.g., `cargo check`, `npm test`, `pnpm build`).
- Checking installed CLI tools and environment versions (e.g., `node -v`, `python --version`).
- File discovery and directory tree inspection (e.g., `ls -la`, `dir /b`).
- Running custom workspace utility scripts.

---

## 2. End-to-End Execution Flow

```
┌────────────────────────────────────────────────────────┐
│               LLM Agent (Rig / Ollama)                 │
│  1. Generates tool call: `run_shell(cmd, cwd)`         │
│  2. Emits `tool_request` event with unique request ID  │
└───────────────────────────┬────────────────────────────┘
                            │ Tauri Event ("tool_request")
┌───────────────────────────▼────────────────────────────┐
│          Frontend Tool Engine (`useToolListener`)      │
│  3. Dispatches to `runShellTool(...)`                  │
│  4. Resolves `workspaceRoot` from Jotai store          │
│  5. Calls API client `executeShellCommand(...)`        │
└───────────────────────────┬────────────────────────────┘
                            │ Tauri IPC (`invoke("execute_shell_command")`)
┌───────────────────────────▼────────────────────────────┐
│             Backend Command (`commands/shell.rs`)      │
│  6. Spawns OS shell process with timeout guard         │
│  7. Captures stdout/stderr streams & exit code         │
│  8. Truncates output if exceeding safety limits        │
│  9. Returns structured `ShellExecutionResult`          │
└───────────────────────────┬────────────────────────────┘
                            │ Returns JSON result
┌───────────────────────────▼────────────────────────────┐
│      Frontend resolves and invokes `llm2_tool_result`  │
│ 10. Displays toast notification & updates ToolCallCard │
│ 11. Returns output back to Rust LLM orchestrator       │
└────────────────────────────────────────────────────────┘
```

---

## 3. Tool Specification

### Tool Identifiers
- **Primary Name**: `run_shell`
- **Aliases**: `execute_shell`, `shell_command`, `exec_command`

### Input Arguments (`RunShellArgs`)

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `command` | `string` | **Yes** | - | The shell command line string to execute. |
| `cwd` | `string` | No | `workspace_root` | Working directory path. If omitted, automatically defaults to the active workspace root. |
| `timeout_ms` | `number` | No | `30000` | Process execution timeout in milliseconds (clamped between 1,000ms and 120,000ms). |

### Output Result (`ShellExecutionResult`)

| Field | Type | Description |
|---|---|---|
| `command` | `string` | The command that was executed. |
| `cwd` | `string` | The resolved absolute path where the process executed. |
| `stdout` | `string` | Standard output stream text. Truncated if exceeding 4,000 characters. |
| `stderr` | `string` | Standard error stream text. Truncated if exceeding 4,000 characters. |
| `exit_code` | `number` | Process exit status code (`0` indicates success, non-zero indicates failure). |
| `success` | `boolean` | `true` if `exit_code === 0`, `false` otherwise. |
| `truncated` | `boolean` | `true` if either `stdout` or `stderr` was trimmed for token length protection. |
| `duration_ms` | `number` | Elapsed execution time in milliseconds. |

---

## 4. Cross-Platform Implementation

Process spawning is implemented in `src-tauri/src/commands/shell.rs` using `tokio::process::Command` with platform-specific shell binaries:

### Windows (`target_os = "windows"`)
- Uses `cmd.exe` with arguments `["/C", command]`.
- Paths are normalized according to Windows filesystem rules.

### macOS & Linux (`not(target_os = "windows")`)
- Uses `$SHELL` environment variable if available, falling back to `/bin/sh`.
- Executes with arguments `["-c", command]`.

---

## 5. Security & Safety Safeguards

1. **Workspace Path Isolation**:
   - When no `cwd` is supplied, the tool automatically resolves to the currently opened workspace directory (`workspaceRootAtom`), ensuring commands don't inadvertently run in the app's installation root or arbitrary locations.
2. **Process Timeout & Cancellation**:
   - Uses `tokio::time::timeout` (default 30 seconds).
   - Configured with `.kill_on_drop(true)` on the command future so that any cancelled or timed-out process is killed immediately to prevent orphaned child processes.
3. **Context Length Truncation**:
   - `stdout` and `stderr` are capped at **4,000 characters** each (~1,000 tokens) with a message notice (`...(truncated: exceeded 4000 characters)`). This prevents large outputs (such as huge build logs or directory traversals) from blowing up the LLM token context buffer.

---

## 6. Code Structure & Key Files

| Layer | File Path | Description |
|---|---|---|
| **Rust Backend Command** | `src-tauri/src/commands/shell.rs` | Tauri command `execute_shell_command` with cross-platform spawning, timeout, and output truncation. |
| **Rust Rig Tool Bridge** | `src-tauri/src/llm2/tools/shell.rs` | Implements Rig's `PortableTool` trait for `run_shell`. |
| **Rust Agent Loop** | `src-tauri/src/llm2/agent.rs` | Ollama function schema, match dispatcher, and system prompt integration. |
| **Frontend API Client** | `src/api-client/shell.ts` | Type-safe wrapper for Tauri invoke `execute_shell_command`. |
| **Frontend Tool Engine** | `src/features/LLMChat2/tools/shell/runShell.ts` | Frontend tool logic resolving `workspaceRootAtom` and dispatching Sonner notifications. |
| **Frontend Tool Listener** | `src/features/LLMChat2/hooks/useToolListener.ts` | Handles `tool_request` events for `run_shell` and returns results to backend. |
| **UI Card Inspector** | `src/features/LLMChat2/components/ToolCallCard.tsx` | Visual card component with `Terminal` icon, exit code badge, duration, and syntax-styled stdout/stderr views. |

---

## 7. Example Agent Invocations

### Example 1: Git Status Check
```json
{
  "name": "run_shell",
  "arguments": {
    "command": "git status --short"
  }
}
```

### Example 2: Checking Installed Dependencies
```json
{
  "name": "run_shell",
  "arguments": {
    "command": "npm list --depth=0",
    "timeout_ms": 15000
  }
}
```

### Example 3: Running Tests in Subfolder
```json
{
  "name": "run_shell",
  "arguments": {
    "command": "cargo check",
    "cwd": "src-tauri"
  }
}
```
