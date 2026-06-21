# Multi-Tab Terminal Component

Implement a robust, cross-platform multi-tab terminal component inside the Depdok application. The terminal runs in a resizable, toggleable bottom panel in the Editor workspace, allowing developers to execute shell commands within their active workspace.

## User Review Required

> [!IMPORTANT]
> **Dependency Additions**
> - Frontend: Adds `@xterm/xterm` and `@xterm/addon-fit` via `pnpm` (the unscoped `xterm` / `xterm-addon-fit` packages are unmaintained — use the current scoped packages).
> - Backend: Adds `portable-pty = "0.8"` (or latest v2-compatible version) to `src-tauri/Cargo.toml`.
>
> **Global State & Storage**
> - Terminal tab state (active tab, open tabs, dimensions) is managed using Jotai.
> - Default shell and general terminal settings are persisted using the existing `settingsService` (localStorage-backed).
> - Tab list (names, shell paths) is persisted across app restarts; the underlying shell process and scrollback are **not** restored — see Open Question 3.
>
> **Tauri API Decoupling**
> - All Tauri command invocations and event subscriptions will be wrapped in `src/api-client/terminal.ts` to strictly adhere to the project's decoupling rules (`global.md`).
>
> **Security**
> - PTY commands are unrestricted code execution from the webview. Confirm these commands are scoped in the Tauri capabilities/allowlist config and not reachable from any remote or untrusted content rendered in the same webview.

## Open Questions

> [!NOTE]
> **1. Workspace Directory Syncing**
> - When opening a new terminal tab, should the working directory automatically default to the current active workspace root (`workspaceRoot`)? (Recommended: Yes, automatically start the shell process with the active workspace directory as its working directory. If no workspace is open, fall back to the user's home directory.)
>
> **2. Shortcut/Footer Trigger**
> - How would you like to toggle the terminal panel?
>   - Keyboard shortcut (e.g. `Ctrl+\``)
>   - A dedicated icon button in the main header/titlebar
>   - A dedicated indicator/button in the footer status bar (Recommended: Both shortcut and status bar button)
>
> **3. Tab Restore on Restart**
> - On app restart, persisted tabs are recreated as **fresh shell sessions** (no scrollback, new process) rather than a true session restore. Acceptable for v1? (Recommended: Yes — true session persistence/replay is a larger effort and out of scope here.)
>
> **4. Shell Exit Behavior**
> - When the underlying process exits (e.g. user types `exit`, or it crashes), should the tab auto-close, or stay open showing a "process exited" state with a restart button? (Recommended: stay open with a restart option, so the user doesn't lose tab position/order mid-workflow.)

## Proposed Changes

---

### Backend Components (Tauri & Rust)

#### [MODIFY] [Cargo.toml](file:///Users/hudy/ws/depdok/src-tauri/Cargo.toml)
- Add `portable-pty = "0.8"` dependency under `[dependencies]`.

#### [NEW] [terminal.rs](file:///Users/hudy/ws/depdok/src-tauri/src/commands/terminal.rs)
- Create a PTY state manager struct `TerminalState` hosting:
  - `sessions`: Map of session IDs to a `PtySession` struct containing:
    - `master`: `Box<dyn MasterPty + Send>` — required for resizing (see below).
    - `writer`: boxed PTY writer for input.
    - `child`: child process handle, for safe termination and exit detection.
- Implement Tauri command handlers:
  - `start_pty_session(app_handle, tab_id, shell_path, cwd, cols, rows) -> Result<(), String>`: Spawns PTY with `TERM=xterm-256color` set in the child's environment (inheriting and otherwise passing through the parent env), spawns a reader thread emitting `pty-data-{tab_id}` events, spawns a watcher that emits a `pty-exit-{tab_id}` event when the child process terminates, and stores the session. Returns an `Err` with a readable message if spawning fails (bad shell path, permission denied, etc.) so the frontend can surface a failure state instead of a silently dead tab.
  - `write_to_pty(tab_id, data) -> Result<(), String>`: Writes input stream bytes to the PTY writer.
  - `resize_pty(tab_id, cols, rows) -> Result<(), String>`: Calls `.resize()` on the stored `master` handle to adjust PTY dimensions — this requires retaining the master handle in `PtySession`, not just the writer.
  - `close_pty_session(tab_id) -> Result<(), String>`: Gracefully terminates the PTY and child process, removes the session entry.
- Register an app-exit hook (via `RunEvent::Exit` in `lib.rs`, see below) that iterates all live sessions and force-kills their child processes, to prevent orphaned shell processes (and anything launched from them) surviving a force-quit or crash.

#### [MODIFY] [mod.rs](file:///Users/hudy/ws/depdok/src-tauri/src/commands/mod.rs)
- Register the new `terminal` command module: `pub mod terminal;`.

#### [MODIFY] [lib.rs](file:///Users/hudy/ws/depdok/src-tauri/src/lib.rs)
- Instantiate and manage `TerminalState` in the Tauri builder `.setup()`.
- Register the terminal command handlers (`start_pty_session`, `write_to_pty`, `resize_pty`, `close_pty_session`) inside `.invoke_handler()`.
- Add a `RunEvent::Exit` handler that walks `TerminalState` and kills any remaining child processes before the app fully exits.
- Confirm/limit the Tauri capabilities config so these commands are not exposed to any remote or untrusted webview content.

---

### Frontend API Layer & Utilities

#### [NEW] [terminal.ts](file:///Users/hudy/ws/depdok/src/api-client/terminal.ts)
- Implement decoupled frontend wrappers:
  - `startPtySession(tabId: string, shellPath: string, cwd: string, cols: number, rows: number): Promise<void>` — rejects with a readable error on spawn failure.
  - `writeToPty(tabId: string, data: string): Promise<void>`
  - `resizePty(tabId: string, cols: number, rows: number): Promise<void>`
  - `closePtySession(tabId: string): Promise<void>`
  - `onPtyData(tabId: string, callback: (data: string) => void): UnlistenFn`
  - `onPtyExit(tabId: string, callback: () => void): UnlistenFn` — surfaces backend process-exit events so the UI can show the "process exited" state from Open Question 4.
- Callers (in `TerminalInstance.tsx`) must invoke the returned `UnlistenFn` on unmount/tab-close; since each tab registers a dynamically-named event (`pty-data-{tab_id}`), failing to unlisten leaks a listener per opened-and-closed tab over a session.

---

### Frontend Global State

#### [NEW] [TerminalStore.ts](file:///Users/hudy/ws/depdok/src/stores/TerminalStore.ts)
- Create Jotai atoms for:
  - `isTerminalOpenAtom`: Boolean showing if the bottom drawer is open.
  - `terminalTabsAtom`: List of open terminal tabs (`id`, `name`, `shellPath`, `status: 'running' | 'exited' | 'error'`).
  - `activeTerminalTabIdAtom`: Currently focused terminal tab ID.
  - `terminalHeightAtom`: Current height of the resizable bottom terminal panel.
- `terminalTabsAtom`'s tab metadata (name, shellPath, order) is persisted via `settingsService`; on load, tabs are recreated as new sessions per Open Question 3 — this should be a one-line comment in code so it isn't mistaken for a real restore.

---

### Frontend Components & Views

#### [NEW] [TerminalInstance.tsx](file:///Users/hudy/ws/depdok/src/features/Terminal/TerminalInstance.tsx)
- The Xterm renderer for a single PTY instance, using `@xterm/xterm` and `@xterm/addon-fit`.
- Handles DOM rendering ref, initializing Xterm and `FitAddon`.
- Binds keyboard events (`term.onData`) to PTY writes via `writeToPty`. Paste events are batched into a single write rather than firing per-character, to avoid flooding IPC on large pastes.
- Listens to PTY output data via `onPtyData` and writes it to the terminal screen.
- Listens to `onPtyExit` and updates the tab's `status` to `'exited'`, rendering a "process exited — restart" affordance per Open Question 4, rather than auto-closing the tab.
- Stays mounted (hidden via CSS, not unmounted) when its tab is inactive, so scrollback and running output are preserved while switching tabs.
- Handles automatic resize updates, debounced to avoid excessive `resize_pty` calls during a drag-resize.

#### [NEW] [TerminalPanel.tsx](file:///Users/hudy/ws/depdok/src/features/Terminal/TerminalPanel.tsx)
- Main terminal container panel at the bottom of the workspace.
- Renders the tab bar:
  - List of tabs (click to switch, double click to rename).
  - Plus button to add a new tab (dropdown selection of default shells — see shell discovery note below).
  - Close button for tabs.
  - Minimize/close button for the panel.
- Resizable vertical handler at the top border of the panel.
- Mounts and keeps all `TerminalInstance` components alive (see above) inside a viewport, toggling visibility rather than mount state.
- **Shell discovery for the dropdown**: on macOS/Linux, read `/etc/shells`; on Windows, probe for the presence of PowerShell, `cmd.exe`, and Git Bash at their conventional install paths. Falls back to a hardcoded minimal list (`/bin/bash`, `/bin/zsh`, `powershell.exe`) if discovery fails.

#### [MODIFY] [Editor.tsx](file:///Users/hudy/ws/depdok/src/pages/Editor.tsx)
- Embed `TerminalPanel` at the bottom of the main content layout.
- Bind keyboard shortcuts to toggle terminal state.

#### [MODIFY] [Footer.tsx](file:///Users/hudy/ws/depdok/src/components/Footer.tsx)
- Add a terminal button (e.g. icon with label "Terminal") in the bottom left, letting the user toggle the terminal drawer.

---

## Verification Plan

### Automated Verification
- Run `pnpm build` to verify TypeScript builds without compile errors.
- Add Rust-side tests for the PTY commands: spawn/write/resize/close complete without panics, and `start_pty_session` returns a clean `Err` (not a panic) for an invalid shell path.
- Add frontend unit tests for the `terminal.ts` API wrapper (mocked Tauri invoke/event layer) and for the `TerminalStore` atoms.

### Manual Verification
- **Spawning PTYs**: Open multiple tabs, verify separate shells spawn and function independently.
- **Terminal Resize**: Resize the bottom panel and verify `FitAddon` and PTY dimensions align correctly (confirm the master-handle resize actually changes rows/cols as seen by e.g. `tput cols` inside the shell).
- **Shell Compatibility**: Verify shell selection works correctly on macOS (e.g., `/bin/zsh`) and Windows (e.g., `powershell.exe`).
- **State Persistence**: Verify closing and reopening the drawer retains terminals, and settings are saved properly.
- **No workspace open**: Open a new tab with no workspace active and confirm cwd falls back to the home directory rather than erroring.
- **Orphan process cleanup**: Spawn a shell, run a long-lived child process (e.g. `npm run dev`), force-quit the app, and confirm no orphaned processes remain.
- **Process exit handling**: Type `exit` in a shell and confirm the tab shows the exited state with a restart option rather than closing or hanging.
- **High-output flooding**: Run a command that produces a large burst of output (e.g. `cat` on a large file) and confirm the UI remains responsive.
- **Listener cleanup**: Open and close several tabs in a loop and confirm via dev tools that PTY-data event listeners are not accumulating.