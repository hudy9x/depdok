import { useRef } from 'react';

/**
 * Maximum number of tabs kept alive in DOM at any time (LRU eviction).
 * Tabs beyond this limit are unmounted; re-opening them cold-starts (~300ms).
 * Increase for faster switching at the cost of more memory.
 */
export const DEFAULT_MAX_KEEP_ALIVE = 8;

export interface UseKeepAliveTabsOptions {
  activeTabId: string | null;
  tabs: Array<{ id: string }>;
  maxKeepAlive?: number;
}

/**
 * Custom hook to manage LRU keep-alive tab IDs for DOM retention.
 *
 * Keeps up to `maxKeepAlive` recently active tabs mounted in the DOM.
 * When a tab is closed, it is automatically purged from the keep-alive cache.
 */
export function useKeepAliveTabs({
  activeTabId,
  tabs,
  maxKeepAlive = DEFAULT_MAX_KEEP_ALIVE,
}: UseKeepAliveTabsOptions): string[] {
  const visitedRef = useRef<Set<string>>(new Set());
  const lruRef = useRef<string[]>([]);

  // Mark the active tab as visited and update LRU order
  if (activeTabId) {
    const id = activeTabId;

    // Move to end of LRU list (most recently used)
    const idx = lruRef.current.indexOf(id);
    if (idx !== -1) {
      lruRef.current.splice(idx, 1);
    }
    lruRef.current.push(id);

    // Mount this tab
    visitedRef.current.add(id);

    // Evict oldest entries beyond maxKeepAlive
    while (visitedRef.current.size > maxKeepAlive) {
      const oldest = lruRef.current.shift();
      if (oldest) {
        visitedRef.current.delete(oldest);
      }
    }
  }

  // When a tab is closed, remove it from visited + LRU so its DOM is GC'd
  const currentTabIds = new Set(tabs.map((t) => t.id));
  for (const id of Array.from(visitedRef.current)) {
    if (!currentTabIds.has(id)) {
      visitedRef.current.delete(id);
      const idx = lruRef.current.indexOf(id);
      if (idx !== -1) {
        lruRef.current.splice(idx, 1);
      }
    }
  }

  return Array.from(visitedRef.current);
}
