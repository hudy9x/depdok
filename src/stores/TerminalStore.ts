import { atom } from 'jotai';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type TerminalTabStatus = 'running' | 'exited' | 'error';

export interface TerminalTab {
  id: string;
  name: string;
  shellPath: string;
  status: TerminalTabStatus;
  /** IDs of PTY sessions split side-by-side in this tab. Defaults to [id] if empty/undefined. */
  splitIds?: string[];
}

// ─── Local storage helpers ─────────────────────────────────────────────────────
// Per project rules, localStorage access is abstracted here — components/stores
// do NOT access localStorage directly.

const STORAGE_PREFIX = 'depdok-terminal:';

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function lsSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error(`[TerminalStore] Failed to persist key "${key}":`, e);
  }
}

// ─── Persistence helpers ────────────────────────────────────────────────────────
// Only tab metadata (id, name, shellPath) is persisted across restarts — the
// underlying shell process and scrollback are NOT restored (fresh session per plan
// Open Question 3).

function loadPersistedTabs(): TerminalTab[] {
  const raw = lsGet<Array<Omit<TerminalTab, 'status'>>>('tabs', []);
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => ({ ...t, status: 'running' as TerminalTabStatus }));
}

function persistTabs(tabs: TerminalTab[]): void {
  lsSet(
    'tabs',
    tabs.map(({ id, name, shellPath }) => ({ id, name, shellPath })),
  );
}

// ─── Atoms ─────────────────────────────────────────────────────────────────────

export type TerminalPosition = 'bottom' | 'right';

/** Whether the terminal bottom panel is currently visible. */
export const isTerminalOpenAtom = atom<boolean>(lsGet<boolean>('is_open', false));

/** List of open terminal tabs (persisted across restarts as fresh sessions). */
export const terminalTabsAtom = atom<TerminalTab[]>(loadPersistedTabs());

/** The ID of the currently focused terminal tab. */
export const activeTerminalTabIdAtom = atom<string | null>(
  lsGet<string | null>('active_tab_id', null),
);

/** The ID of the currently focused split PTY session. */
export const activeSplitSessionIdAtom = atom<string | null>(null);

/** Height (in px) of the resizable bottom terminal panel. */
export const terminalHeightAtom = atom<number>(lsGet<number>('height', 280));

/** Width (in px) of the resizable right terminal panel. */
export const terminalWidthAtom = atom<number>(lsGet<number>('width', 400));

/** Position of the terminal panel ('bottom' | 'right'). */
export const terminalPositionAtom = atom<TerminalPosition>(
  lsGet<TerminalPosition>('position', 'bottom'),
);

// ─── Write atoms (with side-effects) ───────────────────────────────────────────

/** Toggle or explicitly set the terminal panel open/closed. */
export const setIsTerminalOpenAtom = atom(null, (_get, set, value: boolean) => {
  set(isTerminalOpenAtom, value);
  lsSet('is_open', value);
});

/** Update the active tab id and persist it. */
export const setActiveTerminalTabIdAtom = atom(null, (get, set, id: string | null) => {
  set(activeTerminalTabIdAtom, id);
  lsSet('active_tab_id', id);

  if (id) {
    const tabs = get(terminalTabsAtom);
    const tab = tabs.find((t) => t.id === id);
    if (tab) {
      const currentSplits = tab.splitIds && tab.splitIds.length > 0 ? tab.splitIds : [tab.id];
      set(activeSplitSessionIdAtom, currentSplits[currentSplits.length - 1]);
    }
  } else {
    set(activeSplitSessionIdAtom, null);
  }
});

/** Update the panel height and persist it. */
export const setTerminalHeightAtom = atom(null, (_get, set, height: number) => {
  set(terminalHeightAtom, height);
  lsSet('height', height);
});

/** Update the panel width and persist it. */
export const setTerminalWidthAtom = atom(null, (_get, set, width: number) => {
  set(terminalWidthAtom, width);
  lsSet('width', width);
});

/** Update the panel position and persist it. */
export const setTerminalPositionAtom = atom(
  null,
  (_get, set, position: TerminalPosition) => {
    set(terminalPositionAtom, position);
    lsSet('position', position);
  },
);

/** Add a new terminal tab and make it active. */
export const addTerminalTabAtom = atom(null, (get, set, tab: TerminalTab) => {
  const tabs = [...get(terminalTabsAtom), tab];
  set(terminalTabsAtom, tabs);
  persistTabs(tabs);
  set(activeTerminalTabIdAtom, tab.id);
  lsSet('active_tab_id', tab.id);
  set(activeSplitSessionIdAtom, tab.id);
});

/** Remove a terminal tab by id and adjust the active tab. */
export const removeTerminalTabAtom = atom(null, (get, set, tabId: string) => {
  const tabs = get(terminalTabsAtom).filter((t) => t.id !== tabId);
  set(terminalTabsAtom, tabs);
  persistTabs(tabs);

  if (get(activeTerminalTabIdAtom) === tabId) {
    const newActive = tabs.length > 0 ? tabs[tabs.length - 1].id : null;
    set(activeTerminalTabIdAtom, newActive);
    lsSet('active_tab_id', newActive);
    if (newActive) {
      const newActiveTab = tabs[tabs.length - 1];
      const splits = newActiveTab.splitIds && newActiveTab.splitIds.length > 0 ? newActiveTab.splitIds : [newActiveTab.id];
      set(activeSplitSessionIdAtom, splits[splits.length - 1]);
    } else {
      set(activeSplitSessionIdAtom, null);
    }
  }
});

/** Update the status of a terminal tab (running | exited | error). */
export const updateTerminalTabStatusAtom = atom(
  null,
  (get, set, { tabId, status }: { tabId: string; status: TerminalTabStatus }) => {
    const tabs = get(terminalTabsAtom).map((t) =>
      t.id === tabId ? { ...t, status } : t,
    );
    set(terminalTabsAtom, tabs);
  },
);

/** Rename a terminal tab. */
export const renameTerminalTabAtom = atom(
  null,
  (get, set, { tabId, name }: { tabId: string; name: string }) => {
    const tabs = get(terminalTabsAtom).map((t) => (t.id === tabId ? { ...t, name } : t));
    set(terminalTabsAtom, tabs);
    persistTabs(tabs);
  },
);

/** Split a terminal tab by ID. */
export const splitTerminalTabAtom = atom(
  null,
  (get, set, tabId: string) => {
    const newSubId = crypto.randomUUID();
    const tabs = get(terminalTabsAtom).map((t) => {
      if (t.id === tabId) {
        const currentSplits = t.splitIds && t.splitIds.length > 0 ? t.splitIds : [t.id];
        return { ...t, splitIds: [...currentSplits, newSubId] };
      }
      return t;
    });
    set(terminalTabsAtom, tabs);
    persistTabs(tabs);
    set(activeSplitSessionIdAtom, newSubId);
  },
);

/** Remove a PTY session from a split terminal. If it's the last split, close the tab entirely. */
export const closeSplitSessionAtom = atom(
  null,
  (get, set, { tabId, subSessionId }: { tabId: string; subSessionId: string }) => {
    const tabs = get(terminalTabsAtom);
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    const currentSplits = tab.splitIds && tab.splitIds.length > 0 ? tab.splitIds : [tab.id];
    const newSplits = currentSplits.filter((sid) => sid !== subSessionId);

    if (newSplits.length === 0) {
      set(removeTerminalTabAtom, tabId);
    } else {
      const updatedTabs = tabs.map((t) => {
        if (t.id === tabId) {
          return { ...t, splitIds: newSplits };
        }
        return t;
      });
      set(terminalTabsAtom, updatedTabs);
      persistTabs(updatedTabs);

      if (get(activeSplitSessionIdAtom) === subSessionId) {
        set(activeSplitSessionIdAtom, newSplits[newSplits.length - 1]);
      }
    }
  },
);
