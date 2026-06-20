import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

// ---------------------------------------------------------------------------
// Single-file watcher (existing — used by useFileWatcher hook)
// ---------------------------------------------------------------------------

/**
 * Start watching a file for changes.
 * Automatically stops watching any previously watched file.
 */
export async function startWatching(filePath: string): Promise<void> {
  await invoke('start_watching', { path: filePath });
}

/** Stop watching the current file. */
export async function stopWatching(): Promise<void> {
  await invoke('stop_watching');
}

/**
 * Listen for file change events.
 * @returns Unlisten function to cleanup the listener.
 */
export async function onFileChanged(
  callback: (filePath: string) => void
): Promise<UnlistenFn> {
  return await listen<string>('file-changed', (event) => {
    callback(event.payload);
  });
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
