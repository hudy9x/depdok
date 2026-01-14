import { atom } from 'jotai';
import { settingsService } from "@/lib/settings";

export type ViewMode = 'side-by-side' | 'editor-only' | 'preview-only';

export interface EditorState {
  filePath: string | null;
  fileExtension: string | null;
  isDirty: boolean;
  lastSaved: Date | null;
  viewMode: ViewMode;
}

// Get initial view mode from settings
const initialSettings = settingsService.getSettings();

// Main editor state atom (metadata only, no content)
export const editorStateAtom = atom<EditorState>({
  filePath: null,
  fileExtension: null,
  isDirty: false,
  lastSaved: null,
  viewMode: initialSettings.viewMode,
});

// Derived atom for file path
export const filePathAtom = atom(
  (get) => get(editorStateAtom).filePath,
  (get, set, newPath: string | null) => {
    const state = get(editorStateAtom);
    set(editorStateAtom, { ...state, filePath: newPath });
  }
);

// Derived atom for file extension
export const fileExtensionAtom = atom(
  (get) => get(editorStateAtom).fileExtension,
  (get, set, newExtension: string | null) => {
    const state = get(editorStateAtom);
    set(editorStateAtom, { ...state, fileExtension: newExtension });
  }
);

// Derived atom for view mode
export const viewModeAtom = atom(
  (get) => get(editorStateAtom).viewMode,
  (get, set, newMode: ViewMode) => {
    const state = get(editorStateAtom);
    set(editorStateAtom, { ...state, viewMode: newMode });
  }
);

// Action to mark file as dirty (has unsaved changes in IndexedDB)
export const markAsDirtyAtom = atom(null, (get, set) => {
  const state = get(editorStateAtom);
  set(editorStateAtom, { ...state, isDirty: true });
});

// Action to mark file as saved
export const markAsSavedAtom = atom(null, (get, set) => {
  const state = get(editorStateAtom);
  set(editorStateAtom, {
    ...state,
    isDirty: false,
    lastSaved: new Date(),
  });
});

// Action to load a file (metadata only)
export const loadFileMetadataAtom = atom(
  null,
  (get, set, payload: { path: string; extension: string; isDirty: boolean }) => {
    const currentState = get(editorStateAtom);
    set(editorStateAtom, {
      filePath: payload.path,
      fileExtension: payload.extension,
      isDirty: payload.isDirty,
      lastSaved: null,
      viewMode: currentState.viewMode, // Preserve current view mode
    });
  }
);
