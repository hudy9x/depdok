import { atom } from 'jotai';

/**
 * Stores the last content we wrote to disk per file path.
 * Used by useFileWatcher to compare disk content and skip spurious
 * "file changed externally" toasts caused by our own writes.
 * The draft is removed after auto-save so we can't rely on IndexedDB.
 */
export const lastSavedContentMap = new Map<string, string>();


// Currently watched file path (null if no file is being watched)
export const currentWatchedFileAtom = atom<string | null>(null);

// File change notification for the current file
// Contains the file path if there's a pending notification
export const fileChangeNotificationAtom = atom<string | null>(null);

/**
 * Tracks which file path the app is currently saving to disk.
 * null = not saving. string = the absolute path currently being written.
 * Used to prevent file watcher from reacting to our own saves.
 */
export const isSavingAtom = atom<string | null>(null);

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
