import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

/**
 * Start watching a file for changes
 * Automatically stops watching any previously watched file
 * @param filePath - Path of the file to watch
 */
export async function startWatching(filePath: string): Promise<void> {
  await invoke('start_watching', { path: filePath });
}

/**
 * Stop watching the current file
 */
export async function stopWatching(): Promise<void> {
  await invoke('stop_watching');
}

/**
 * Listen for file change events
 * @param callback - Function to call when a file changes
 * @returns Unlisten function to cleanup the listener
 */
export async function onFileChanged(
  callback: (filePath: string) => void
): Promise<UnlistenFn> {
  return await listen<string>('file-changed', (event) => {
    callback(event.payload);
  });
}
