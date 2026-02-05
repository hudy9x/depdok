import { atom } from 'jotai';

// Currently watched file path (null if no file is being watched)
export const currentWatchedFileAtom = atom<string | null>(null);

// File change notification for the current file
// Contains the file path if there's a pending notification
export const fileChangeNotificationAtom = atom<string | null>(null);

/**
 * Tracks whether the app is currently saving a file
 * Used to prevent file watcher from reacting to our own saves
 */
export const isSavingAtom = atom<boolean>(false);

// Action: Set the currently watched file
export const setWatchedFileAtom = atom(
  null,
  (_get, set, filePath: string | null) => {
    set(currentWatchedFileAtom, filePath);
  }
);

// Action: Clear the watched file
export const clearWatchedFileAtom = atom(null, (_get, set) => {
  set(currentWatchedFileAtom, null);
});

// Action: Record a file change notification
export const setFileChangeNotificationAtom = atom(
  null,
  (_get, set, filePath: string) => {
    set(fileChangeNotificationAtom, filePath);
  }
);

// Action: Clear the file change notification
export const clearFileChangeNotificationAtom = atom(null, (_get, set) => {
  set(fileChangeNotificationAtom, null);
});
