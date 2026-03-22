# Multiple Windows Architecture

This document outlines the architecture and implementation details for supporting fully isolated, persistent multiple windows in Depdok.

## 1. Storage & State Isolation

Previously, all application state was synchronized via React Jotai atoms backed by the browser's `localStorage`. Because `localStorage` is shared globally across the entire webview origin, opening a second window would cause its state to overwrite or conflict with the first window (e.g., closing a tab in Window A would close it in Window B).

To solve this, state management was split into a **Two-Tier Storage Architecture**:

### Tier 1: Active Window Session (`sessionStorage`)
The live, second-to-second state for a running window is now stored exclusively in the browser's `sessionStorage`. 
- **Isolated:** Every time a new window is spawned, its `sessionStorage` is cleanly boxed and isolated by the OS context.
- **Transitory:** It disappears completely the moment the window closes, preventing orphaned `localStorage` data bloat.
- **Affected Atoms:** `tabsAtom`, `activeTabIdAtom`, `workspaceRootAtom`, `expandedFoldersArrayAtom`, `isFileExplorerVisibleAtom`.
- **Implementation:** Integrated into Jotai via a custom `sessionStorageDriver`.

### Tier 2: Persistent Project Memory (`store.json`)
To ensure users do not lose their opened files/folders when closing the app, the "memory" of a specific project resides in an encrypted native disk file managed by the Rust backend using `@tauri-apps/plugin-store`.
- **Global Dictionary:** It maintains a dictionary (`depdok-projects-state`) mapping folder paths to their last known tabs and expanded folders.
- **Background Sync:** The `useProjectStateSync` hook quietly monitors changes in the active `sessionStorage` and debounces a save operation to the native `store.json`.
- **Seamless Re-entry:** When a user selects a project from their "Recent Folders", the app queries `store.json`. If a saved state exists, it instantly loads those tabs into the new window's active `sessionStorage`.

## 2. LRU Eviction Strategy

To prevent `store.json` from indefinitely expanding as users open new folders over years of use, an automatic Least Recently Used (LRU) eviction strategy replaces static expiration timers.

- `recentFoldersAtom` inherently limits the "Recent Folders" list to 20 paths.
- Within `openWorkspaceAtom`, whenever a new folder is mapped, the app cross-references all keys within the `depdok-projects-state` dictionary.
- If a project's state belongs to a folder that has naturally fallen off the 20-folder recency list, its saved states are permanently purged from disk to guarantee ultra-fast `store.json` read/write speeds.

## 3. Dynamic Titlebar & UI Draggability

Because new windows are spawned dynamically without native OS decorations (`.decorations(false)`), they require manually implemented "titlebars".

- **The Drag Mechanism:** The custom `useWindowDrag` React hook directly wraps `getCurrentWindow().startDragging()` from the Tauri API. 
- **Event Delegation:** The hook was elevated to the top-level `TitlebarContainer`, giving the entire 35px header drag properties.
- **Click Interception Bug:** A bug occurred where clicking macOS/Windows "close/minimize" UI buttons mistakenly triggered the newly elevated `useWindowDrag` hook, silently swallowing the click event. 
- **The Fix:** The localized `<MacOSButtons>` and `<WindowsButtons>` groupings were wrapped in `<div data-tauri-drag-region="false">`. The `useWindowDrag` hook was explicitly programmed to check for this falsy property in its DOM tree propagation and instantly abort the drag invocation, allowing the UI click handlers to fire cleanly.

## 4. Tauri v2 Security Capabilities

Tauri v2 enforces a strict capability-based authorization matrix. 
- Previously, permissions in `src-tauri/capabilities/default.json` were strictly hardcoded to the `"main"` window.
- When dynamic windows were instantiated (e.g., `"window-1774191436429"`), they were completely stripped of all API capabilities. This caused the dragging `event.listen` API to crash and blocked `@tauri-apps/plugin-store` communication (`store.load` denied).
- Setup was permanently resolved by registering `"window-*"` into the `windows` authorization array, granting all dynamic instances full system APIs. 
- Explicit `"store:default"` permission was also added to legally expose disk persistence access to Javascript.

## 5. Startup Routing

When a brand-new window initiates, its `sessionStorage` begins empty. The `Checking.tsx` startup page correctly reads this emptiness not as a failure, but as a fresh state. Instead of erroneously attempting to mount the `/editor` with a blank slate, it routes correctly to `/home`, fulfilling the required behavior for spawning duplicate workspace instances.
