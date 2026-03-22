import { invoke } from '@tauri-apps/api/core';

/** Open a new independent app window starting at the Home page. */
export const openNewWindow = (): Promise<void> =>
  invoke('open_new_window');

/**
 * Push the current recent-folders list to the Rust backend so the
 * macOS dock context menu can be rebuilt with the updated entries.
 * On non-macOS platforms this is a no-op on the Rust side.
 */
export const updateDockMenu = (recentFolders: string[]): Promise<void> =>
  invoke('update_dock_menu', { recentFolders });
