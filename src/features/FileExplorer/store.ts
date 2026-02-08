import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { FileEntry, listDirectory } from './api';
import { FlatTreeNode, flattenTree } from './utils';

// Persisted workspace root path
export const workspaceRootAtom = atomWithStorage<string | null>(
  'depdok-workspace-root',
  null
);

// Persisted expanded folders (stored as array for JSON serialization)
const expandedFoldersArrayAtom = atomWithStorage<string[]>(
  'depdok-expanded-folders',
  []
);

// Derived atom to convert array to Set
export const expandedFoldersAtom = atom(
  (get) => new Set(get(expandedFoldersArrayAtom)),
  (_get, set, update: Set<string>) => {
    set(expandedFoldersArrayAtom, Array.from(update));
  }
);

// Currently selected item path
export const selectedItemAtom = atom<string | null>(null);

// File tree data (loaded from backend)
export const fileTreeDataAtom = atom<Record<string, FileEntry[]>>({});

// Loading state
export const isLoadingAtom = atom<boolean>(false);

// Derived atom: flattened tree for virtual scrolling
export const flattenedTreeAtom = atom<FlatTreeNode[]>((get) => {
  const root = get(workspaceRootAtom);
  const expandedFolders = get(expandedFoldersAtom);
  const treeData = get(fileTreeDataAtom);

  if (!root || !treeData[root]) {
    return [];
  }

  // Flatten the children of the root folder, starting at depth 0
  return flattenTree(treeData[root], expandedFolders, treeData, 0, root);
});

// Action: Open workspace
export const openWorkspaceAtom = atom(
  null,
  async (get, set, rootPath: string) => {
    set(isLoadingAtom, true);
    try {
      const entries = await listDirectory(rootPath);
      set(workspaceRootAtom, rootPath);
      set(fileTreeDataAtom, { ...get(fileTreeDataAtom), [rootPath]: entries });

      // Auto-expand root
      const expanded = get(expandedFoldersAtom);
      expanded.add(rootPath);
      set(expandedFoldersAtom, new Set(expanded));
    } catch (error) {
      console.error('Failed to open workspace:', error);
      throw error;
    } finally {
      set(isLoadingAtom, false);
    }
  }
);

// Action: Toggle folder expand/collapse
export const toggleFolderAtom = atom(
  null,
  async (get, set, folderPath: string) => {
    const expandedFolders = get(expandedFoldersAtom);
    const treeData = get(fileTreeDataAtom);

    if (expandedFolders.has(folderPath)) {
      // Collapse
      expandedFolders.delete(folderPath);
      set(expandedFoldersAtom, new Set(expandedFolders));
    } else {
      // Expand - load children if not already loaded
      if (!treeData[folderPath]) {
        try {
          const entries = await listDirectory(folderPath);
          set(fileTreeDataAtom, { ...treeData, [folderPath]: entries });
        } catch (error) {
          console.error('Failed to load directory:', error);
          return;
        }
      }

      expandedFolders.add(folderPath);
      set(expandedFoldersAtom, new Set(expandedFolders));
    }
  }
);

// Currently selected items paths
export const selectedPathsAtom = atom<Set<string>>(new Set<string>());
// Last selected item path (anchor for shift-selection)
export const lastSelectedPathAtom = atom<string | null>(null);

// Clipboard state
export type ClipboardOperation = 'cut' | 'copy';
export interface ClipboardState {
  paths: string[];
  op: ClipboardOperation;
}
export const clipboardAtom = atom<ClipboardState | null>(null);

// Action: Select item(s)
export const selectItemAtom = atom(
  null,
  (get, set, { path, multiSelect, rangeSelect }: { path: string | null, multiSelect?: boolean, rangeSelect?: boolean }) => {
    if (!path) {
      set(selectedPathsAtom, new Set());
      set(lastSelectedPathAtom, null);
      return;
    }

    const currentSelection = new Set(get(selectedPathsAtom));
    const lastPath = get(lastSelectedPathAtom);

    if (rangeSelect && lastPath) {
      // Handle Shift+Click range selection
      const flatTree = get(flattenedTreeAtom);
      const lastIndex = flatTree.findIndex(n => n.path === lastPath);
      const currentIndex = flatTree.findIndex(n => n.path === path);

      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);

        // If ctrl/cmd is NOT held, we might want to clear previous selection, 
        // but typically shift+click extends from the anchor.
        // Standard behavior: Shift+Click clears selection except anchor and adds range.
        if (!multiSelect) {
          currentSelection.clear();
        }

        for (let i = start; i <= end; i++) {
          currentSelection.add(flatTree[i].path);
        }
      }
    } else if (multiSelect) {
      // Handle Ctrl/Cmd+Click toggle
      if (currentSelection.has(path)) {
        currentSelection.delete(path);
      } else {
        currentSelection.add(path);
      }
      set(lastSelectedPathAtom, path);
    } else {
      // Single click select
      currentSelection.clear();
      currentSelection.add(path);
      set(lastSelectedPathAtom, path);
    }

    set(selectedPathsAtom, currentSelection);
  }
);

// Action: Refresh directory
export const refreshDirectoryAtom = atom(
  null,
  async (get, set, dirPath: string) => {
    try {
      const entries = await listDirectory(dirPath);
      const treeData = get(fileTreeDataAtom);
      set(fileTreeDataAtom, { ...treeData, [dirPath]: entries });
    } catch (error) {
      console.error('Failed to refresh directory:', error);
      throw error;
    }
  }
);

// Persisted FileExplorer visibility state
export const isFileExplorerVisibleAtom = atomWithStorage<boolean>(
  'depdok-file-explorer-visible',
  true
);

// Dialog States
export type FileOperation = {
  isOpen: boolean;
  path: string | null; // The path of the node being operated on (for single item ops)
  paths?: string[]; // For multi-item ops like delete
  type?: 'file' | 'folder'; // For create operations
};

export const renamingNodeAtom = atom<FileOperation>({ isOpen: false, path: null });
export const creatingNodeAtom = atom<FileOperation>({ isOpen: false, path: null }); // path is the parent folder
export const deletingNodeAtom = atom<FileOperation>({ isOpen: false, path: null });

// Helper actions to open dialogs
export const openRenameDialogAtom = atom(null, (_get, set, path: string) => {
  set(renamingNodeAtom, { isOpen: true, path });
});

export const openCreateDialogAtom = atom(null, (_get, set, { path, type }: { path: string; type: 'file' | 'folder' }) => {
  set(creatingNodeAtom, { isOpen: true, path, type });
});

export const openDeleteDialogAtom = atom(null, (_get, set, path: string) => {
  set(deletingNodeAtom, { isOpen: true, path });
});
