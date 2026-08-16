import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

// ---------------------------------------------------------------------------
// Single-file watcher (used by useFileWatcher hook)
// ---------------------------------------------------------------------------

/**
 * Currently watched file path in the Rust backend watcher thread.
 */
let currentWatchedFile: string | null = null;

/**
 * Reference count for the currently watched file.
 *
 * WHY THIS IS NEEDED:
 * In a split editor workspace (or with keep-alive tabs), multiple components
 * (e.g. 2–4 split panels all viewing `notes.md`, or Editor + Preview in SideBySide)
 * mount separate `useFileWatcher` instances for the same file.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ WITHOUT REFERENCE COUNTING (Race Condition & IPC Storm):                   │
 * │                                                                             │
 * │   Panel 1 mounts (notes.md) ──► invoke("start_watching")                   │
 * │   Panel 2 mounts (notes.md) ──► invoke("start_watching")  [Duplicate IPC]  │
 * │   Panel 1 unmounts/unfocus  ──► invoke("stop_watching")   [Kills watcher!] │
 * │                                 └──► Panel 2 SILENTLY LOSES FILE WATCHING! │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ WITH REFERENCE COUNTING (`watchRefCount`):                                  │
 * │                                                                             │
 * │   Panel 1 mounts (notes.md) ──► refCount = 1 ──► invoke("start_watching")   │
 * │   Panel 2 mounts (notes.md) ──► refCount = 2 ──► (0 IPC, instant in memory) │
 * │   Panel 3 mounts (notes.md) ──► refCount = 3 ──► (0 IPC, instant in memory) │
 * │   Panel 1 unmounts/unfocus  ──► refCount = 2 ──► (0 IPC, watcher kept alive)│
 * │   Panel 2 unmounts/unfocus  ──► refCount = 1 ──► (0 IPC, watcher kept alive)│
 * │   Panel 3 unmounts/unfocus  ──► refCount = 0 ──► invoke("stop_watching")    │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */
let watchRefCount = 0;

let fileChangedUnlistenPromise: Promise<UnlistenFn> | null = null;
let fileChangedUnlisten: UnlistenFn | null = null;
const fileChangedSubscribers = new Set<(filePath: string) => void>();

/**
 * Start watching a file for changes.
 * Automatically deduplicates calls using `watchRefCount` so the same file
 * isn't repeatedly started/stopped across multiple split panes or tabs.
 */
export async function startWatching(filePath: string): Promise<void> {
  if (currentWatchedFile === filePath) {
    watchRefCount++;
    return;
  }
  currentWatchedFile = filePath;
  watchRefCount = 1;
  await invoke('start_watching', { path: filePath });
}

/**
 * Stop watching the current file when all subscribers release it.
 * Decrements `watchRefCount` and only sends the backend `stop_watching` IPC
 * when no active panels/tabs are watching this file anymore (`watchRefCount === 0`).
 */
export async function stopWatching(): Promise<void> {
  watchRefCount = Math.max(0, watchRefCount - 1);
  if (watchRefCount === 0 && currentWatchedFile !== null) {
    currentWatchedFile = null;
    await invoke('stop_watching');
  }
}

/**
 * Listen for file change events with a shared global listener to eliminate IPC listen/unlisten storms.
 * @returns Unlisten function to cleanup the subscriber.
 */
export async function onFileChanged(
  callback: (filePath: string) => void
): Promise<UnlistenFn> {
  fileChangedSubscribers.add(callback);

  if (!fileChangedUnlisten && !fileChangedUnlistenPromise) {
    fileChangedUnlistenPromise = listen<string>('file-changed', (event) => {
      fileChangedSubscribers.forEach((cb) => {
        try {
          cb(event.payload);
        } catch (e) {
          console.error('[FileWatcher] Subscriber error:', e);
        }
      });
    }).then((unlisten) => {
      fileChangedUnlisten = unlisten;
      fileChangedUnlistenPromise = null;
      return unlisten;
    });
    await fileChangedUnlistenPromise;
  } else if (fileChangedUnlistenPromise) {
    await fileChangedUnlistenPromise;
  }

  return () => {
    fileChangedSubscribers.delete(callback);
  };
}

// ---------------------------------------------------------------------------
// Workspace watcher — watches an entire workspace directory
// ---------------------------------------------------------------------------

export type ChangeKind = 'created' | 'modified' | 'removed' | 'renamed';

export interface WorkspaceChangeEvent {
  kind: ChangeKind;
  /** Absolute path of the affected file/folder (normalized separators). */
  path: string;
  /** For Renamed events: the original path before the rename. */
  fromPath?: string;
}

/**
 * Start watching the workspace root recursively.
 * Any previously active workspace watcher is stopped first.
 */
export async function startWatchingWorkspace(workspaceRoot: string): Promise<void> {
  await invoke('start_watching_workspace', { workspaceRoot });
}

/** Stop the active workspace watcher. */
export async function stopWatchingWorkspace(): Promise<void> {
  await invoke('stop_watching_workspace');
}

/**
 * Subscribe to workspace change event batches.
 * @returns Unlisten function to cleanup the listener.
 */
export async function onWorkspaceChanged(
  callback: (events: WorkspaceChangeEvent[]) => void
): Promise<UnlistenFn> {
  return await listen<WorkspaceChangeEvent[]>('workspace-changed', (event) => {
    callback(event.payload);
  });
}
