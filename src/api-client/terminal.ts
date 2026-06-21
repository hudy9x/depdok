import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

/**
 * Spawn a new PTY session for the given tab.
 * Rejects with a human-readable error string if the shell cannot be started.
 */
export const startPtySession = (
  tabId: string,
  shellPath: string,
  cwd: string,
  cols: number,
  rows: number,
): Promise<void> =>
  invoke('start_pty_session', { tabId, shellPath, cwd, cols, rows });

/** Send keyboard / paste input to the PTY. */
export const writeToPty = (tabId: string, data: string): Promise<void> =>
  invoke('write_to_pty', { tabId, data });

/** Notify the backend that the terminal panel has been resized. */
export const resizePty = (tabId: string, cols: number, rows: number): Promise<void> =>
  invoke('resize_pty', { tabId, cols, rows });

/** Terminate the shell and remove its session entry. */
export const closePtySession = (tabId: string): Promise<void> =>
  invoke('close_pty_session', { tabId });

/**
 * Subscribe to output from the PTY.
 * Returns an unlisten function — **must** be called on tab-close / component unmount
 * to prevent listener leaks.
 */
export const onPtyData = (tabId: string, callback: (data: string) => void): Promise<UnlistenFn> =>
  listen<string>(`pty-data-${tabId}`, (event) => callback(event.payload));

/**
 * Subscribe to the shell-exited notification for a tab.
 * Returns an unlisten function — **must** be called on tab-close / component unmount.
 */
export const onPtyExit = (tabId: string, callback: () => void): Promise<UnlistenFn> =>
  listen<null>(`pty-exit-${tabId}`, () => callback());
