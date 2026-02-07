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

  return flattenTree(treeData[root], expandedFolders, treeData);
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

// Action: Select item
export const selectItemAtom = atom(null, (_get, set, itemPath: string | null) => {
  set(selectedItemAtom, itemPath);
});

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
