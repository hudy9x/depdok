# Implementation Plan v2: OS Integration for Depdok (Context Menu & CLI)

This plan is split into two **independent** features. Each can be designed, implemented, and shipped on its own schedule — neither blocks the other.

- **Feature A — Windows Explorer Context Menu Integration**
- **Feature B — Cross-platform CLI (`depdok` command) + Single-Instance IPC**

The original plan's core architecture (Tauri Rust backend writing OS integration, React frontend reacting to forwarded paths) is correct and retained. This version fixes specific gaps: missing icon registration, an underspecified CLI shim, no real design for macOS/Linux install, a risky "auto-register on every startup" default, and missing edge cases (multi-file args, missing paths, uninstall cleanup).

---

## Feature A: Windows Explorer Context Menu

### Goal
Right-clicking a file or folder in Explorer shows an "Open with Depdok" / "Open Folder with Depdok" entry, with the Depdok icon, that launches the app with that path.

### Design decisions (resolved from review)

| Decision | Choice | Why |
|---|---|---|
| Registry scope | `HKEY_CURRENT_USER` | No UAC/admin required; matches VS Code's approach |
| When registered | **Installer time**, not app runtime | Avoids silent registry writes on every launch; matches VS Code/Cursor convention |
| File type scope | All files (`*`) for v1 | Matches VS Code default; can be narrowed later via settings if requested |
| Desktop background | Explicitly excluded/tested | `Directory\Background` can also apply to desktop in some Explorer versions — needs a deliberate test, not an assumption |
| Icon | Required, not optional | Without it you get a generic icon and it looks broken/unfinished |

### Registry keys to write

```
HKCU\Software\Classes\*\shell\Depdok
    (Default)   = "Open with Depdok"
    Icon        = "C:\Path\To\Depdok.exe,0"
    HKCU\...\Depdok\command
        (Default) = "\"C:\Path\To\Depdok.exe\" \"%1\""

HKCU\Software\Classes\Directory\shell\Depdok
    (Default)   = "Open Folder with Depdok"
    Icon        = "C:\Path\To\Depdok.exe,0"
    HKCU\...\Depdok\command
        (Default) = "\"C:\Path\To\Depdok.exe\" \"%V\""

HKCU\Software\Classes\Directory\Background\shell\Depdok
    (Default)   = "Open Folder with Depdok"
    Icon        = "C:\Path\To\Depdok.exe,0"
    HKCU\...\Depdok\command
        (Default) = "\"C:\Path\To\Depdok.exe\" \"%V\""
```

Notes:
- `%1` = clicked file path; `%V` = current folder path (works for both the folder-icon click and the background right-click).
- Use `MUIVerb` instead of the bare default string if you want the label localized later — not required for v1, but cheap to add now.
- `Position` value (`"Top"`) can be set if you want the entry above the Windows default list rather than buried in "Show more options."

### Where this is implemented

- **Preferred: installer-time**, via the NSIS script Tauri's bundler generates (`tauri.conf.json` → `bundle.windows.nsis` custom script hooks). Registry keys are written during install and removed during uninstall automatically — this solves cleanup for free.
- **Fallback (if installer-time isn't feasible short-term):** a Tauri command (`register_context_menu()` / `unregister_context_menu()`) exposed to the frontend, triggered **only** by an explicit user action — a button in Settings, not a startup side-effect. If you go this route, the uninstaller must *still* attempt cleanup independently (see Cleanup below), since a user may uninstall without ever opening Settings.

### Cleanup / uninstall

- If installer-managed: NSIS uninstaller deletes the same keys it wrote. Verify this explicitly — it's not automatic just because the installer wrote them; the uninstall script needs matching `DeleteRegKey` calls.
- If app-managed: ship a best-effort cleanup call in the uninstaller too (Tauri bundler supports custom uninstall hooks), so a user who never toggled the setting off doesn't leave orphaned keys.

### Settings UI

- Toggle: **"Show Depdok in right-click menu"** — reflects current registry state on load (read, don't assume), allows enable/disable without reinstalling.

### Verification plan (Feature A)

1. Fresh Windows VM/sandbox (not a dev machine with accumulated state) — install, right-click a `.md` file, confirm icon + label + correct launch with file path.
2. Right-click empty space inside a folder → "Open Folder with Depdok" → confirm correct folder opens.
3. Right-click the **desktop background** specifically — confirm expected behavior (in or out of scope, per the decision above) rather than discovering it by accident.
4. Toggle off in Settings (if app-managed) → confirm registry keys removed → right-click menu entry gone.
5. Uninstall app entirely → confirm no orphaned `HKCU\Software\Classes\*\shell\Depdok` keys remain.

---

## Feature B: Cross-Platform CLI (`depdok`) + Single-Instance IPC

### Goal
From any terminal: `depdok .` opens the current folder; `depdok file.md` opens a file; if Depdok is already running, the existing window is focused and the new path is opened in it rather than spawning a second instance.

### Design decisions (resolved from review)

| Decision | Choice | Why |
|---|---|---|
| What `depdok` actually is | A **thin shim**, not the GUI binary directly | Matches VS Code (`code.cmd`/`code` shim vs `Code.exe`); keeps CLI argument semantics separate from GUI launch semantics, leaves room for `--wait`/`--new-window` later |
| Windows PATH registration | `HKCU\Environment`, pointing at the shim's folder | No admin required |
| Windows PATH refresh | Explicitly tell user to **restart terminal** | `WM_SETTINGCHANGE` broadcast updates Explorer eventually, but already-open shells never see it — don't imply it "just works" |
| macOS/Linux install | **Opt-in, explicit user action**, mirrors VS Code's "Shell Command: Install" | Writing to `/usr/local/bin` typically needs elevated permission; doing this silently on startup is a bad pattern and a security-review red flag |
| Linux packaging | Defer to package format where possible | `.deb`/`.rpm` can drop the binary in `/usr/bin` at install time (no runtime symlink needed); AppImage needs the runtime opt-in flow |
| Multi-file args | Support `depdok a.md b.md` → opens both in tabs | Cheap to support now, expensive to retrofit the parser later |
| Missing/invalid path | Show a toast/notification, don't fail silently | Basic UX hygiene |

### B.1 — The shim itself

- **Windows**: a small `depdok.cmd` (or compiled tiny `.exe`) in the same install folder as `Depdok.exe`, e.g.:
  ```
  @echo off
  start "" "%~dp0Depdok.exe" %*
  ```
  PATH is pointed at this folder, not directly treated as "Depdok.exe is the CLI."
- **macOS**: a shell script shim placed via symlink at `/usr/local/bin/depdok` (or `/opt/homebrew/bin` on Apple Silicon if that's already on PATH), pointing into the `.app` bundle's `Contents/Resources/bin/depdok` helper script — same pattern VS Code uses.
- **Linux**:
  - `.deb`/`.rpm`: binary placed directly in `/usr/bin/depdok` at package-install time via postinst — no runtime action needed.
  - AppImage: runtime opt-in flow creates the symlink (see B.2).

### B.2 — Install flow for the shim (macOS / AppImage Linux)

- A **command in Settings or a command palette**, e.g. "Install 'depdok' command in PATH" (not automatic, not on startup).
- Triggering it requests elevation explicitly:
  - macOS: `osascript -e 'do shell script "ln -sf ... " with administrator privileges'`
  - Linux: `pkexec` or equivalent, or instruct the user to run a one-line `sudo` command themselves if elevation plumbing is out of scope for v1.
- On success/failure, show a clear confirmation or error in the UI — don't fail silently.

### B.3 — Rust backend: argument parsing & single instance

- Add `tauri-plugin-single-instance` (as in the original plan — correct choice).
- `setup` hook (first launch):
  - Parse `std::env::args()`.
  - Support **one or more** path arguments, not just one (per the multi-file decision above).
  - Resolve each relative path against `std::env::current_dir()` of *this* process.
  - Classify each as file vs directory; store as `PendingOpenPaths` state for the frontend to consume on mount.
- Single-instance callback (subsequent launches):
  - Receives `(argv, cwd)` from the *new* invocation — **must** resolve relative paths against that forwarded `cwd`, not the primary instance's cwd (this was correctly flagged in the original plan; keeping it here as a hard requirement, not just a nice-to-have).
  - Validate each resolved path exists; for any that don't, collect them for a single user-facing notification rather than silently dropping or crashing.
  - Emit `open-paths` (plural, to support multi-file) event to the frontend.
  - Focus the main window: `unminimize()`, `show()`, `set_focus()`.

### B.4 — Frontend (React)

- `useCLIListener.ts` hook:
  - On mount: invoke `get_pending_open_paths` (plural) for first-launch args.
  - Listen for `open-paths` event for subsequent invocations.
  - For each path: if directory → `openWorkspace(path)`; if file → `createTab({ filePath, fileName, switchTo: true })`. With multiple files, only the last one (or first — decide explicitly) takes `switchTo: true`; others open as background tabs.
  - For any paths reported as missing/invalid by the backend: show a toast, don't navigate.
  - Navigate to `/editor` once paths are processed.

### Stub for future flags (not implemented in v1, but worth reserving in the parser shape now)
- `--new-window` / `-n`
- `--version`
- `--help`

### Verification plan (Feature B)

1. **Fresh terminal, first launch**: `depdok .` from an empty terminal with no app running → app opens with that folder as workspace.
2. **Fresh terminal, file**: `depdok README.md` → opens as a tab.
3. **Multi-file**: `depdok a.md b.md` → both open as tabs, confirm which one is focused matches the decided behavior.
4. **Already running, IPC forward**: with app open, run `depdok other.md` from a **different terminal/cwd** than the app's own working directory → confirm path resolves against the terminal's cwd, not the app's, and the main window gets focus.
5. **Missing path**: `depdok does-not-exist.md` → confirm a clear error/toast, not a silent no-op or crash.
6. **PATH not yet refreshed**: open a terminal *before* installing, confirm `depdok` is correctly reported as "not found" rather than partially working — and that the docs/UI tell the user to open a new terminal after install.
7. **macOS/Linux opt-in install**: run the "Install command in PATH" action, confirm elevation prompt appears, confirm `depdok` works from a new terminal afterward, confirm a clear failure state if elevation is denied.
8. **Uninstall**: confirm shim/symlink is removed or at least left harmless (no dangling symlink to a deleted binary).

---

## Cross-cutting items (apply to both features)

- **Code signing**: unsigned binaries that write to the registry or `/usr/local/bin` will draw more scrutiny (SmartScreen on Windows, Gatekeeper on macOS). Not blocking for v1, but flag as a known rough edge before wider release.
- **Clean-VM testing**: both features are easy to "work" on a dev machine that already has stale registry/PATH state from earlier test runs, and silently fail on a genuinely fresh machine. Test on a clean VM/sandbox for both, not just locally.
- **Settings reflect real state**: any toggle (context menu, CLI install) should read actual current state on load, not just track its own last-set value — otherwise a manual registry edit or failed install desyncs the UI from reality.