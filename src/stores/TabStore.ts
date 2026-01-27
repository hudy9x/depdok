import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

export interface Tab {
  id: string;
  filePath: string; // Real path or UNTITLED://filename.ext
  fileName: string;
  fileExtension: string | null;
  isDirty: boolean;
  isActive: boolean;
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

// Tabs array (persisted in localStorage)
export const tabsAtom = atomWithStorage<Tab[]>('depdok-tabs', []);

// Active tab ID (persisted in localStorage)
export const activeTabIdAtom = atomWithStorage<string | null>(
  'depdok-active-tab-id',
  null
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
  (get, set, payload: { filePath: string; fileName: string; switchTo?: boolean }) => {
    const tabs = get(tabsAtom);
    const { filePath, fileName, switchTo = true } = payload;

    // Check if tab already exists
    const existingTab = tabs.find((tab) => tab.filePath === filePath);
    if (existingTab) {
      if (switchTo) {
        set(activeTabIdAtom, existingTab.id);
      }
      return existingTab.id;
    }

    const newTab: Tab = {
      id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      filePath,
      fileName,
      fileExtension: getFileExtension(fileName),
      isDirty: false,
      isActive: switchTo,
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
export const closeTabAtom = atom(null, (get, set, tabId: string) => {
  const tabs = get(tabsAtom);
  const activeId = get(activeTabIdAtom);
  const tabIndex = tabs.findIndex((t) => t.id === tabId);

  if (tabIndex === -1) return;

  const newTabs = tabs.filter((t) => t.id !== tabId);
  set(tabsAtom, newTabs);

  // If closing active tab, switch to another tab
  if (activeId === tabId && newTabs.length > 0) {
    // Switch to the tab before the closed one, or the first tab
    const newActiveIndex = tabIndex > 0 ? tabIndex - 1 : 0;
    set(activeTabIdAtom, newTabs[newActiveIndex]?.id || null);
  } else if (newTabs.length === 0) {
    set(activeTabIdAtom, null);
  }
});

// Action: Update tab metadata
export const updateTabAtom = atom(
  null,
  (get, set, payload: { tabId: string; updates: Partial<Tab> }) => {
    const tabs = get(tabsAtom);
    const { tabId, updates } = payload;

    const newTabs = tabs.map((tab) =>
      tab.id === tabId ? { ...tab, ...updates } : tab
    );

    set(tabsAtom, newTabs);
  }
);

// Action: Mark tab as dirty
export const markTabAsDirtyAtom = atom(null, (_get, set, tabId: string) => {
  set(updateTabAtom, { tabId, updates: { isDirty: true } });
});

// Action: Mark tab as saved
export const markTabAsSavedAtom = atom(null, (_get, set, tabId: string) => {
  set(updateTabAtom, { tabId, updates: { isDirty: false } });
});

// Action: Update tab path (used after save-as)
export const updateTabPathAtom = atom(
  null,
  (_get, set, payload: { tabId: string; newPath: string }) => {
    const { tabId, newPath } = payload;
    const fileName = newPath.split('/').pop() || 'Untitled';
    const fileExtension = getFileExtension(fileName);

    set(updateTabAtom, {
      tabId,
      updates: {
        filePath: newPath,
        fileName,
        fileExtension,
      },
    });
  }
);
