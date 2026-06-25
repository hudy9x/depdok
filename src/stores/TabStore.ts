import { atom } from 'jotai';
import { atomWithStorage, atomFamily } from 'jotai/utils';
import {
  activePaneIdAtom,
  paneTreeAtom,
  updatePaneTabsAtom,
  updatePaneActiveTabIdAtom,
  findPaneNode,
  closePaneAtom,
  type PaneNode,
} from './PaneStore';

export interface Tab {
  id: string;
  filePath: string; // Real path or UNTITLED://filename.ext
  fileName: string;
  fileExtension: string | null;
  isDirty: boolean;
  isActive: boolean;
  isPreview: boolean;
  lineNumber?: number; // Optional line number to jump to when opening
  isDeleted?: boolean; // True when the file/parent folder was deleted externally
}

// Helper function to check if path is a dummy path
export const isDummyPath = (path: string): boolean => {
  return path.startsWith('UNTITLED://');
};

// Helper function to extract filename from dummy path
export const extractFilenameFromDummyPath = (path: string): string => {
  return path.replace('UNTITLED://', '');
};

// Helper function to get file extension
export const getFileExtension = (filename: string): string | null => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : null;
};

// Counter for untitled files (persisted in localStorage)
export const nextUntitledCounterAtom = atomWithStorage<number>(
  'depdok-untitled-counter',
  1
);

export const paneTabsAtomFamily = atomFamily((paneId: string) =>
  atom<Tab[], [Tab[] | ((prev: Tab[]) => Tab[])], void>(
    (get) => {
      const node = findPaneNode(get(paneTreeAtom), paneId);
      return node?.type === 'leaf' ? node.pane.tabs : [];
    },
    (get, set, newTabs) => {
      const currentTabs = get(paneTabsAtomFamily(paneId));
      const resolvedTabs = typeof newTabs === 'function' ? newTabs(currentTabs) : newTabs;
      set(updatePaneTabsAtom, { paneId, tabs: resolvedTabs });
    }
  )
);

export const paneActiveTabIdAtomFamily = atomFamily((paneId: string) =>
  atom<string | null, [string | null | ((prev: string | null) => string | null)], void>(
    (get) => {
      const node = findPaneNode(get(paneTreeAtom), paneId);
      return node?.type === 'leaf' ? node.pane.activeTabId : null;
    },
    (get, set, newActiveTabId) => {
      const currentActiveId = get(paneActiveTabIdAtomFamily(paneId));
      const resolvedActiveId = typeof newActiveTabId === 'function' ? newActiveTabId(currentActiveId) : newActiveTabId;
      set(updatePaneActiveTabIdAtom, { paneId, activeTabId: resolvedActiveId });
    }
  )
);

// Legacy globals (pointing to the active/focused pane)
export const tabsAtom = atom<Tab[], [Tab[] | ((prev: Tab[]) => Tab[])], void>(
  (get) => {
    const activePaneId = get(activePaneIdAtom);
    return get(paneTabsAtomFamily(activePaneId));
  },
  (get, set, update) => {
    const activePaneId = get(activePaneIdAtom);
    set(paneTabsAtomFamily(activePaneId), update);
  }
);

export const activeTabIdAtom = atom<string | null, [string | null | ((prev: string | null) => string | null)], void>(
  (get) => {
    const activePaneId = get(activePaneIdAtom);
    return get(paneActiveTabIdAtomFamily(activePaneId));
  },
  (get, set, update) => {
    const activePaneId = get(activePaneIdAtom);
    set(paneActiveTabIdAtomFamily(activePaneId), update);
  }
);

// Derived atom to get active tab
export const activeTabAtom = atom((get) => {
  const tabs = get(tabsAtom);
  const activeId = get(activeTabIdAtom);
  return tabs.find((tab) => tab.id === activeId) || null;
});

// Action: Create a new tab
export const createTabAtom = atom(
  null,
  (get, set, payload: { filePath: string; fileName: string; switchTo?: boolean; isPreview?: boolean; lineNumber?: number }) => {
    const tabs = get(tabsAtom);
    const { filePath, fileName, switchTo = true, isPreview = false } = payload;

    // Check if tab already exists
    const existingTab = tabs.find((tab) => tab.filePath === filePath);
    if (existingTab) {
      if (switchTo) {
        set(activeTabIdAtom, existingTab.id);
      }
      // If we are opening permanently (isPreview=false) and it was preview, pin it.
      if (!isPreview && existingTab.isPreview) {
        const newTabs = tabs.map(t => t.id === existingTab.id ? { ...t, isPreview: false, lineNumber: payload.lineNumber } : t);
        set(tabsAtom, newTabs);
      } else if (payload.lineNumber !== undefined) {
        // Update lineNumber even if tab exists - set it temporarily, will be cleared after jump
        const newTabs = tabs.map(t => t.id === existingTab.id ? { ...t, lineNumber: payload.lineNumber } : t);
        set(tabsAtom, newTabs);

        // Clear lineNumber after a short delay to allow the effect to trigger
        setTimeout(() => {
          const currentTabs = get(tabsAtom);
          const clearedTabs = currentTabs.map(t => t.id === existingTab.id ? { ...t, lineNumber: undefined } : t);
          set(tabsAtom, clearedTabs);
        }, 500);
      }
      return existingTab.id;
    }

    // Check if we can recycle an existing preview tab
    // Only recycle if we are not creating a dirty/untitled tab (usually those are distinct)
    // But here we just get filePath.
    // If there is a preview tab, and it is not dirty (implied by isPreview=true usually, but let's be safe), replace it.
    const previewTab = tabs.find(t => t.isPreview);

    // Logic: If we are creating a NEW tab (path not found), and there is a preview tab, reuse it.
    // Regardless of whether new request is preview or not.
    if (previewTab) {
      const updatedTab: Tab = {
        ...previewTab,
        filePath,
        fileName,
        fileExtension: getFileExtension(fileName),
        isPreview: isPreview, // updates to new state (e.g. might remain preview or become pinned)
        isActive: switchTo,
        lineNumber: payload.lineNumber,
      };

      const newTabs = tabs.map(t => t.id === previewTab.id ? updatedTab : t);
      set(tabsAtom, newTabs);

      if (switchTo) {
        set(activeTabIdAtom, previewTab.id);
      }
      return previewTab.id;
    }

    const newTab: Tab = {
      id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      filePath,
      fileName,
      fileExtension: getFileExtension(fileName),
      isDirty: false,
      isActive: switchTo,
      isPreview,
      lineNumber: payload.lineNumber,
    };

    set(tabsAtom, [...tabs, newTab]);

    if (switchTo) {
      set(activeTabIdAtom, newTab.id);
    }

    return newTab.id;
  }
);

// Action: Create untitled tab
export const createUntitledTabAtom = atom(
  null,
  (get, set, filename: string) => {
    const counter = get(nextUntitledCounterAtom);
    const dummyPath = `UNTITLED://${filename}`;

    const tabId = set(createTabAtom, {
      filePath: dummyPath,
      fileName: filename,
      switchTo: true,
      isPreview: false, // Untitled tabs are always permanent/dirty-ready
    });

    set(nextUntitledCounterAtom, counter + 1);
    return tabId;
  }
);

// Action: Switch to a tab
export const switchTabAtom = atom(null, (get, set, tabId: string) => {
  const tabs = get(tabsAtom);
  const tab = tabs.find((t) => t.id === tabId);

  if (tab) {
    set(activeTabIdAtom, tabId);
  }
});

// Action: Close a tab
export const closeTabAtom = atom(
  null,
  (get, set, arg: string | { tabId: string; paneId: string }) => {
    const tabId = typeof arg === 'string' ? arg : arg.tabId;
    const activePaneId = get(activePaneIdAtom);
    const paneId = typeof arg === 'string' ? activePaneId : arg.paneId;

    const paneTabsAtom = paneTabsAtomFamily(paneId);
    const paneActiveTabIdAtom = paneActiveTabIdAtomFamily(paneId);

    const tabs = get(paneTabsAtom);
    const activeId = get(paneActiveTabIdAtom);
    const tabIndex = tabs.findIndex((t) => t.id === tabId);

    if (tabIndex === -1) return;

    const newTabs = tabs.filter((t) => t.id !== tabId);
    set(paneTabsAtom, newTabs);

    // If closing active tab, switch to another tab
    if (activeId === tabId && newTabs.length > 0) {
      // Switch to the tab before the closed one, or the first tab
      const newActiveIndex = tabIndex > 0 ? tabIndex - 1 : 0;
      set(paneActiveTabIdAtom, newTabs[newActiveIndex]?.id || null);
    } else if (newTabs.length === 0) {
      set(paneActiveTabIdAtom, null);
      // Close the pane since there are no tabs left
      set(closePaneAtom, paneId);
    }
  }
);

// Action: Update tab metadata
export const updateTabAtom = atom(
  null,
  (get, set, payload: { tabId: string; updates: Partial<Tab>; paneId?: string }) => {
    const activePaneId = get(activePaneIdAtom);
    const paneId = payload.paneId || activePaneId;
    const paneTabsAtom = paneTabsAtomFamily(paneId);
    const tabs = get(paneTabsAtom);
    const { tabId, updates } = payload;

    const newTabs = tabs.map((tab) =>
      tab.id === tabId ? { ...tab, ...updates } : tab
    );

    set(paneTabsAtom, newTabs);
  }
);

// Action: Mark tab as dirty
export const markTabAsDirtyAtom = atom(
  null,
  (_get, set, arg: string | { tabId: string; paneId: string }) => {
    const tabId = typeof arg === 'string' ? arg : arg.tabId;
    const paneId = typeof arg === 'string' ? undefined : arg.paneId;
    set(updateTabAtom, { tabId, updates: { isDirty: true, isPreview: false }, paneId });
  }
);

// Action: Mark tab as saved
export const markTabAsSavedAtom = atom(
  null,
  (_get, set, arg: string | { tabId: string; paneId: string }) => {
    const tabId = typeof arg === 'string' ? arg : arg.tabId;
    const paneId = typeof arg === 'string' ? undefined : arg.paneId;
    set(updateTabAtom, { tabId, updates: { isDirty: false }, paneId });
  }
);

// Action: Update tab path (used after save-as or rename)
export const updateTabPathAtom = atom(
  null,
  (_get, set, payload: { tabId: string; newPath: string; paneId?: string }) => {
    const { tabId, newPath, paneId } = payload;
    const fileName = newPath.split(/[/\\]/).pop() || 'Untitled';
    const fileExtension = getFileExtension(fileName);

    set(updateTabAtom, {
      tabId,
      updates: {
        filePath: newPath,
        fileName,
        fileExtension,
        isDeleted: false, // clear ghost state whenever path is updated
      },
      paneId,
    });
  }
);

// Helper: normalise path separators for cross-platform prefix matching
const normalisePathSep = (p: string): string => p.replace(/\\/g, '/');

// Helper: check if candidatePath is the deletedPath or a descendant of it
const isPathOrDescendant = (candidatePath: string, deletedPath: string): boolean => {
  const c = normalisePathSep(candidatePath);
  const d = normalisePathSep(deletedPath);
  return c === d || c.startsWith(d + '/');
};

// Helper to update all panes' tabs recursively
const updateAllPanesTabs = (node: PaneNode, updater: (tabs: Tab[]) => Tab[]): PaneNode => {
  if (node.type === 'leaf') {
    const newTabs = updater(node.pane.tabs);
    let activeTabId = node.pane.activeTabId;
    if (activeTabId && !newTabs.some((t) => t.id === activeTabId)) {
      activeTabId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
    }
    return {
      type: 'leaf',
      pane: {
        ...node.pane,
        tabs: newTabs,
        activeTabId,
      },
    };
  }
  return {
    ...node,
    children: node.children.map((child) => updateAllPanesTabs(child, updater)),
  };
};

/**
 * Action: Mark all tabs whose filePath is the given path or a descendant as deleted.
 * Used when a file or folder is removed externally.
 */
export const markTabsDeletedByPrefixAtom = atom(
  null,
  (get, set, deletedPath: string) => {
    const tree = get(paneTreeAtom);
    const updated = updateAllPanesTabs(tree, (tabs) =>
      tabs.map((tab) =>
        isPathOrDescendant(tab.filePath, deletedPath)
          ? { ...tab, isDeleted: true, isDirty: true }
          : tab
      )
    );
    set(paneTreeAtom, updated);
  }
);

/**
 * Action: Clear isDeleted on tabs that match a given path or are descendants.
 * Used when a previously deleted file is restored (e.g. `git checkout`).
 */
export const restoreTabsByPrefixAtom = atom(
  null,
  (get, set, restoredPath: string) => {
    const tree = get(paneTreeAtom);
    const updated = updateAllPanesTabs(tree, (tabs) =>
      tabs.map((tab) =>
        tab.isDeleted && isPathOrDescendant(tab.filePath, restoredPath)
          ? { ...tab, isDeleted: false }
          : tab
      )
    );
    set(paneTreeAtom, updated);
  }
);

/**
 * Action: Update tab paths when a file or folder is renamed.
 * For a renamed folder, all descendant tab paths are rewritten preserving relative paths.
 */
export const updateTabsPathByPrefixAtom = atom(
  null,
  (get, set, payload: { fromPath: string; toPath: string }) => {
    const { fromPath, toPath } = payload;
    const from = normalisePathSep(fromPath);

    const tree = get(paneTreeAtom);
    const updated = updateAllPanesTabs(tree, (tabs) =>
      tabs.map((tab) => {
        const tabPath = normalisePathSep(tab.filePath);
        let newPath: string | null = null;

        if (tabPath === from) {
          newPath = toPath;
        } else if (tabPath.startsWith(from + '/')) {
          // Descendant: replace the prefix, preserve relative sub-path
          newPath = toPath + tab.filePath.slice(fromPath.length);
        }

        if (newPath === null) return tab;

        const fileName = newPath.split(/[/\\]/).pop() || tab.fileName;
        const fileExtension = getFileExtension(fileName);
        return {
          ...tab,
          filePath: newPath,
          fileName,
          fileExtension,
          isDeleted: false,
        };
      })
    );
    set(paneTreeAtom, updated);
  }
);

// Action: Close all tabs except the specified one
export const closeOtherTabsAtom = atom(
  null,
  (get, set, arg: string | { tabId: string; paneId: string }) => {
    const tabId = typeof arg === 'string' ? arg : arg.tabId;
    const activePaneId = get(activePaneIdAtom);
    const paneId = typeof arg === 'string' ? activePaneId : arg.paneId;

    const paneTabsAtom = paneTabsAtomFamily(paneId);
    const paneActiveTabIdAtom = paneActiveTabIdAtomFamily(paneId);

    const tabs = get(paneTabsAtom);
    const tabToKeep = tabs.find((t) => t.id === tabId);

    if (!tabToKeep) return;

    set(paneTabsAtom, [tabToKeep]);
    set(paneActiveTabIdAtom, tabId);
  }
);

// Action: Close all tabs
export const closeAllTabsAtom = atom(
  null,
  (get, set, paneId?: string | { paneId: string }) => {
    const activePaneId = get(activePaneIdAtom);
    const resolvedPaneId = !paneId ? activePaneId : (typeof paneId === 'string' ? paneId : paneId.paneId);
    set(paneTabsAtomFamily(resolvedPaneId), []);
    set(paneActiveTabIdAtomFamily(resolvedPaneId), null);
    set(closePaneAtom, resolvedPaneId);
  }
);
