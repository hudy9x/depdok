import { invoke } from '@tauri-apps/api/core';

/** Check if the explorer context menu right-click entry is registered */
export const checkContextMenuStatus = (): Promise<boolean> =>
  invoke('check_context_menu_status');

/** Register the right-click Explorer context menu entries */
export const registerContextMenu = (): Promise<void> =>
  invoke('register_context_menu');

/** Unregister the right-click Explorer context menu entries */
export const unregisterContextMenu = (): Promise<void> =>
  invoke('unregister_context_menu');
