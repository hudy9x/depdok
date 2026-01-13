import { atom } from 'jotai';

export interface EditorState {
  filePath: string | null;
  fileContent: string;
  fileExtension: string | null;
  isDirty: boolean;
  lastSaved: Date | null;
}

// Main editor state atom
export const editorStateAtom = atom<EditorState>({
  filePath: null,
  fileContent: '',
  fileExtension: null,
  isDirty: false,
  lastSaved: null,
});

// Derived atom for file path
export const filePathAtom = atom(
  (get) => get(editorStateAtom).filePath,
  (get, set, newPath: string | null) => {
    const state = get(editorStateAtom);
    set(editorStateAtom, { ...state, filePath: newPath });
  }
);

// Derived atom for file content
export const fileContentAtom = atom(
  (get) => get(editorStateAtom).fileContent,
  (get, set, newContent: string) => {
    const state = get(editorStateAtom);
    set(editorStateAtom, {
      ...state,
      fileContent: newContent,
      isDirty: true,
    });
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

// Action to mark file as saved
export const markAsSavedAtom = atom(null, (get, set) => {
  const state = get(editorStateAtom);
  set(editorStateAtom, {
    ...state,
    isDirty: false,
    lastSaved: new Date(),
  });
});

// Action to load a file
export const loadFileAtom = atom(
  null,
  (_get, set, payload: { path: string; content: string; extension: string }) => {
    set(editorStateAtom, {
      filePath: payload.path,
      fileContent: payload.content,
      fileExtension: payload.extension,
      isDirty: false,
      lastSaved: null,
    });
  }
);
