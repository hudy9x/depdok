import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { sessionStorageDriver } from '@/lib/storage';
import type { Tab } from './TabStore';
import { settingsService } from '@/lib/settings';

export type ViewMode = 'side-by-side' | 'editor-only' | 'preview-only';

export type PaneDirection = 'horizontal' | 'vertical';

export interface Pane {
  id: string;
  tabs: Tab[];
  activeTabId: string | null;
  viewMode: ViewMode;
}

export type PaneNode =
  | { type: 'leaf'; pane: Pane }
  | {
      type: 'split';
      id: string;
      direction: PaneDirection;
      children: PaneNode[];
      sizes: number[];
    };

// Traversal Helpers
export function findPaneNode(node: PaneNode, paneId: string): PaneNode | null {
  if (node.type === 'leaf') {
    return node.pane.id === paneId ? node : null;
  }
  for (const child of node.children) {
    const found = findPaneNode(child, paneId);
    if (found) return found;
  }
  return null;
}

export function findParentSplitNode(
  node: PaneNode,
  childId: string
): { split: Extract<PaneNode, { type: 'split' }>; index: number } | null {
  if (node.type === 'leaf') return null;
  const idx = node.children.findIndex((c) =>
    c.type === 'leaf' ? c.pane.id === childId : c.id === childId
  );
  if (idx !== -1) {
    return { split: node, index: idx };
  }
  for (const child of node.children) {
    const parent = findParentSplitNode(child, childId);
    if (parent) return parent;
  }
  return null;
}

export function collectLeafPanes(node: PaneNode): Pane[] {
  if (node.type === 'leaf') {
    return [node.pane];
  }
  return node.children.flatMap(collectLeafPanes);
}

// Helper to recursively update a leaf pane's attributes
function updatePaneInTree(
  node: PaneNode,
  paneId: string,
  updater: (pane: Pane) => Partial<Pane>
): PaneNode {
  if (node.type === 'leaf') {
    if (node.pane.id === paneId) {
      return {
        type: 'leaf',
        pane: {
          ...node.pane,
          ...updater(node.pane),
        },
      };
    }
    return node;
  }
  return {
    ...node,
    children: node.children.map((child) =>
      updatePaneInTree(child, paneId, updater)
    ),
  };
}

// Initial view mode from settings
const initialSettings = settingsService.getSettings();

const DEFAULT_PANE_ID = 'pane-primary';

// Fallback initial pane tree
const createInitialTree = (): PaneNode => {
  // Attempt to recover legacy tabs session
  let savedTabs: Tab[] = [];
  let savedActiveTabId: string | null = null;
  try {
    const tabsStr = sessionStorage.getItem('depdok-tabs');
    const activeStr = sessionStorage.getItem('depdok-active-tab-id');
    if (tabsStr) {
      savedTabs = JSON.parse(tabsStr);
    }
    if (activeStr) {
      savedActiveTabId = JSON.parse(activeStr);
    }
  } catch (e) {
    console.error('Failed to parse legacy sessionStorage tabs:', e);
  }

  return {
    type: 'leaf',
    pane: {
      id: DEFAULT_PANE_ID,
      tabs: savedTabs,
      activeTabId: savedActiveTabId,
      viewMode: initialSettings.viewMode || 'editor-only',
    },
  };
};

// Root state atoms
export const paneTreeAtom = atomWithStorage<PaneNode>(
  'depdok-pane-tree-v3',
  createInitialTree(),
  sessionStorageDriver
);

export const activePaneIdAtom = atomWithStorage<string>(
  'depdok-active-pane-id-v3',
  DEFAULT_PANE_ID,
  sessionStorageDriver
);

// Derived action to set active (focused) pane
export const focusPaneAtom = atom(null, (_get, set, paneId: string) => {
  set(activePaneIdAtom, paneId);
});

// Update functions
export const updatePaneTabsAtom = atom(
  null,
  (get, set, payload: { paneId: string; tabs: Tab[] }) => {
    const tree = get(paneTreeAtom);
    const updated = updatePaneInTree(tree, payload.paneId, (pane) => {
      // If the activeTabId is no longer present in the tabs, reset it
      let activeTabId = pane.activeTabId;
      if (activeTabId && !payload.tabs.some((t) => t.id === activeTabId)) {
        activeTabId = payload.tabs.length > 0 ? payload.tabs[payload.tabs.length - 1].id : null;
      }
      return { tabs: payload.tabs, activeTabId };
    });
    set(paneTreeAtom, updated);
  }
);

export const updatePaneActiveTabIdAtom = atom(
  null,
  (get, set, payload: { paneId: string; activeTabId: string | null }) => {
    const tree = get(paneTreeAtom);
    const updated = updatePaneInTree(tree, payload.paneId, () => ({
      activeTabId: payload.activeTabId,
    }));
    set(paneTreeAtom, updated);
  }
);

export const updatePaneViewModeAtom = atom(
  null,
  (get, set, payload: { paneId: string; viewMode: ViewMode }) => {
    const tree = get(paneTreeAtom);
    const updated = updatePaneInTree(tree, payload.paneId, () => ({
      viewMode: payload.viewMode,
    }));
    set(paneTreeAtom, updated);
  }
);

// Split Pane action
export const splitPaneAtom = atom(
  null,
  (get, set, payload: { paneId: string; direction: PaneDirection }) => {
    const tree = get(paneTreeAtom);
    const newPaneId = `pane-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newSplitId = `split-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newTabCreator = (activeTab: Tab | null): Tab | null => {
      if (!activeTab) return null;
      return {
        ...activeTab,
        id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        isActive: true,
      };
    };

    function splitPaneInTree(
      node: PaneNode,
      targetId: string,
      dir: PaneDirection
    ): PaneNode {
      if (node.type === 'leaf') {
        if (node.pane.id === targetId) {
          const activeTab = node.pane.tabs.find((t) => t.id === node.pane.activeTabId) || null;
          const newTab = newTabCreator(activeTab);
          const newPane: Pane = {
            id: newPaneId,
            tabs: newTab ? [newTab] : [],
            activeTabId: newTab ? newTab.id : null,
            viewMode: node.pane.viewMode,
          };
          return {
            type: 'split',
            id: newSplitId,
            direction: dir,
            children: [
              node,
              { type: 'leaf', pane: newPane },
            ],
            sizes: [50, 50],
          };
        }
        return node;
      }
      return {
        ...node,
        children: node.children.map((child) =>
          splitPaneInTree(child, targetId, dir)
        ),
      };
    }

    const newTree = splitPaneInTree(tree, payload.paneId, payload.direction);
    set(paneTreeAtom, newTree);
    set(activePaneIdAtom, newPaneId); // Automatically focus the newly created split pane
  }
);

// Close Pane action
export const closePaneAtom = atom(null, (get, set, paneId: string) => {
  const tree = get(paneTreeAtom);
  const activePaneId = get(activePaneIdAtom);

  function closePaneInTree(node: PaneNode, targetId: string): PaneNode | null {
    if (node.type === 'leaf') {
      return node.pane.id === targetId ? null : node;
    }
    const newChildren = node.children
      .map((child) => closePaneInTree(child, targetId))
      .filter((c): c is PaneNode => c !== null);

    if (newChildren.length === 0) return null;
    if (newChildren.length === 1) return newChildren[0];

    // Recalculate panel sizes after removal
    const closedIndex = node.children.findIndex((child) => {
      return findPaneNode(child, targetId) !== null;
    });
    let newSizes = [...node.sizes];
    if (closedIndex !== -1 && closedIndex < newSizes.length) {
      newSizes.splice(closedIndex, 1);
    }
    const sum = newSizes.reduce((a, b) => a + b, 0);
    if (sum > 0) {
      newSizes = newSizes.map((s) => (s / sum) * 100);
    } else {
      newSizes = newChildren.map(() => 100 / newChildren.length);
    }

    return {
      ...node,
      children: newChildren,
      sizes: newSizes,
    };
  }

  const newTree = closePaneInTree(tree, paneId);

  if (newTree) {
    set(paneTreeAtom, newTree);
    if (activePaneId === paneId) {
      const leaves = collectLeafPanes(newTree);
      if (leaves.length > 0) {
        // Focus the last leaf pane
        set(activePaneIdAtom, leaves[leaves.length - 1].id);
      }
    }
  } else {
    // If no panes left, restore to single default leaf pane
    const restoredTree: PaneNode = {
      type: 'leaf',
      pane: {
        id: DEFAULT_PANE_ID,
        tabs: [],
        activeTabId: null,
        viewMode: initialSettings.viewMode || 'editor-only',
      },
    };
    set(paneTreeAtom, restoredTree);
    set(activePaneIdAtom, DEFAULT_PANE_ID);
  }
});
