import { atom } from 'jotai';
import {
  activePaneIdAtom,
  paneTreeAtom,
  findPaneNode,
  updatePaneViewModeAtom,
  type ViewMode,
} from './PaneStore';
import { activeTabAtom } from './TabStore';
import { dirtyFilesAtom, markFileAsDirtyAtom, markFileAsSavedAtom } from './DirtyStore';

export interface EditorState {
  filePath: string | null;
  fileExtension: string | null;
  isDirty: boolean;
  lastSaved: Date | null;
  viewMode: ViewMode;
}

// Derived editor state atom (shims compatibility)
export const editorStateAtom = atom<EditorState>((get) => {
  const activeTab = get(activeTabAtom);
  const activePaneId = get(activePaneIdAtom);
  const node = findPaneNode(get(paneTreeAtom), activePaneId);
  const viewMode = node?.type === 'leaf' ? node.pane.viewMode : 'side-by-side';

  return {
    filePath: activeTab ? activeTab.filePath : null,
    fileExtension: activeTab ? activeTab.fileExtension : null,
    isDirty: activeTab ? get(dirtyFilesAtom).has(activeTab.filePath) : false,
    lastSaved: null,
    viewMode,
  };
});

// Store live content for each file by path to avoid stale content on focus switch
export const liveFilesContentAtom = atom<Record<string, string>>({});

// Track which pane most recently wrote to liveFilesContentAtom for a given file.
// LoadFileContent uses this to skip atom updates that originated from its own pane,
// preventing the keystroke feedback loop in multi-pane same-file editing.
export const liveFilesWriterPaneAtom = atom<Record<string, string>>({});

export const setLiveFileWriterAtom = atom(
  null,
  (get, set, payload: { filePath: string; paneId: string }) => {
    const current = get(liveFilesWriterPaneAtom);
    if (current[payload.filePath] === payload.paneId) return;
    set(liveFilesWriterPaneAtom, { ...current, [payload.filePath]: payload.paneId });
  }
);

// Called when the view mode changes so the newly-mounted view component can
// pick up the latest live content even if it was written by the same pane.
export const clearLiveFileWriterAtom = atom(
  null,
  (get, set, filePath: string) => {
    const current = get(liveFilesWriterPaneAtom);
    if (!(filePath in current)) return;
    const { [filePath]: _removed, ...rest } = current;
    set(liveFilesWriterPaneAtom, rest);
  }
);

// Derived activeFileContentAtom pointing to the focused tab's live content
export const activeFileContentAtom = atom(
  (get) => {
    const activeTab = get(activeTabAtom);
    if (!activeTab) return null;
    return get(liveFilesContentAtom)[activeTab.filePath] ?? null;
  },
  (get, set, newContent: string | null) => {
    const activeTab = get(activeTabAtom);
    if (!activeTab) return;
    const contents = get(liveFilesContentAtom);
    if (newContent === null) {
      const { [activeTab.filePath]: _, ...rest } = contents;
      set(liveFilesContentAtom, rest);
    } else {
      set(liveFilesContentAtom, { ...contents, [activeTab.filePath]: newContent });
    }
  }
);

// Derived atom for file path
export const filePathAtom = atom(
  (get) => get(editorStateAtom).filePath,
  (_get, _set, _newPath: string | null) => {
    // Read-only shim (tabs drive file path now)
  }
);

// Derived atom for file extension
export const fileExtensionAtom = atom(
  (get) => get(editorStateAtom).fileExtension,
  (_get, _set, _newExtension: string | null) => {
    // Read-only shim
  }
);

// Derived atom for view mode (updates current pane's view mode)
export const viewModeAtom = atom(
  (get) => get(editorStateAtom).viewMode,
  (get, set, newMode: ViewMode) => {
    const activePaneId = get(activePaneIdAtom);
    set(updatePaneViewModeAtom, { paneId: activePaneId, viewMode: newMode });
  }
);

// Action to mark active tab/file as dirty
export const markAsDirtyAtom = atom(null, (get, set) => {
  const activeTab = get(activeTabAtom);
  if (activeTab) {
    set(markFileAsDirtyAtom, activeTab.filePath);
  }
});

// Action to mark active tab/file as saved
export const markAsSavedAtom = atom(null, (get, set) => {
  const activeTab = get(activeTabAtom);
  if (activeTab) {
    set(markFileAsSavedAtom, activeTab.filePath);
  }
});

// Action to load a file metadata (noop compatibility shim)
export const loadFileMetadataAtom = atom(
  null,
  (_get, _set, _payload: { path: string; extension: string; isDirty: boolean }) => {
    // Metadata is loaded automatically from activeTab
  }
);
