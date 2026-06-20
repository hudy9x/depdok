import { useEffect } from 'react';
import { useAtomValue, useStore } from 'jotai';

import {
  startWatchingWorkspace,
  stopWatchingWorkspace,
  onWorkspaceChanged,
  type WorkspaceChangeEvent,
} from '@/lib/fileWatcher';
import {
  workspaceRootAtom,
  refreshDirectoryAtom,
  fileTreeDataAtom,
  expandedFoldersAtom,
} from '@/features/FileExplorer/store';
import {
  markTabsDeletedByPrefixAtom,
  restoreTabsByPrefixAtom,
  updateTabsPathByPrefixAtom,
  activeTabAtom,
} from '@/stores/TabStore';
import { activeFileContentAtom } from '@/stores/EditorStore';
import { draftService } from '@/lib/indexeddb';

/** Directories to ignore when deciding whether to react to an event. */
const IGNORED_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'target',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '__pycache__',
  '.cache',
  '.turbo',
  'out',
  'coverage',
]);

const normalise = (p: string) => p.replace(/\\/g, '/');

/** Returns true if any path segment is an ignored directory name. */
function isIgnoredPath(filePath: string): boolean {
  const normalised = normalise(filePath);
  const segments = normalised.split('/');
  const ignored = segments.some((seg) => IGNORED_DIR_NAMES.has(seg) || (seg.startsWith('.') && seg.length > 1));
  if (ignored) {
    console.log('[WorkspaceWatcher] Path matched ignore rules:', filePath);
  }
  return ignored;
}

/** Returns the parent directory of a path. */
function parentDir(filePath: string): string {
  const n = normalise(filePath);
  const idx = n.lastIndexOf('/');
  return idx >= 0 ? filePath.slice(0, idx) : filePath;
}

/**
 * Hook: Watches the currently open workspace for filesystem changes and
 * keeps the file explorer and open tabs in sync.
 *
 * - Starts the Rust workspace watcher when `workspaceRootAtom` is set.
 * - Stops it on unmount or workspace change.
 * - Processes `workspace-changed` events:
 *   - Renamed  → updates matching tab paths
 *   - Removed  → marks matching tabs as deleted (ghost), prunes expandedFolders
 *   - Created / Modified → clears isDeleted on matching tabs (git checkout restore)
 *   - Refreshes only the unique parent directories that are already loaded in the tree
 */
export function useWorkspaceWatcher(): void {
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const store = useStore();

  // Start/stop the Rust watcher when workspace changes.
  useEffect(() => {
    if (!workspaceRoot) {
      console.log('[WorkspaceWatcher] No workspaceRoot set, skipping watcher start.');
      return;
    }

    console.log('[WorkspaceWatcher] 🔄 Starting watch on workspace root:', workspaceRoot);
    startWatchingWorkspace(workspaceRoot)
      .then(() => {
        console.log('[WorkspaceWatcher] ✅ startWatchingWorkspace success for:', workspaceRoot);
      })
      .catch((err) => {
        console.error('[WorkspaceWatcher] ❌ Failed to start:', err);
      });

    return () => {
      console.log('[WorkspaceWatcher] 🛑 Stopping watch on workspace root:', workspaceRoot);
      stopWatchingWorkspace()
        .then(() => {
          console.log('[WorkspaceWatcher] ✅ stopWatchingWorkspace success');
        })
        .catch((err) => {
          console.error('[WorkspaceWatcher] ❌ Failed to stop:', err);
        });
    };
  }, [workspaceRoot]);

  // Subscribe to workspace-changed events.
  useEffect(() => {
    if (!workspaceRoot) return;

    let unlisten: (() => void) | undefined;

    const setup = async () => {
      console.log('[WorkspaceWatcher] 🎧 Subscribing to "workspace-changed" events...');
      unlisten = await onWorkspaceChanged((events: WorkspaceChangeEvent[]) => {
        console.log('[WorkspaceWatcher] 📬 Received workspace changes batch:', events);
        handleBatch(events);
      });
    };

    setup().catch((err) => {
      console.error('[WorkspaceWatcher] ❌ Failed to subscribe:', err);
    });

    return () => {
      if (unlisten) {
        console.log('[WorkspaceWatcher] 🔌 Unsubscribing from "workspace-changed" events');
        unlisten();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceRoot]);

  function handleBatch(events: WorkspaceChangeEvent[]): void {
    /** Unique parent directories to refresh. */
    const parentDirsToRefresh = new Set<string>();

    // Query current state directly from Jotai store at event runtime
    const fileTreeData = store.get(fileTreeDataAtom);
    const expandedFolders = store.get(expandedFoldersAtom);

    console.log('[WorkspaceWatcher] Processing batch. Current expandedFolders:', Array.from(expandedFolders));
    console.log('[WorkspaceWatcher] Current loaded directories in tree:', Object.keys(fileTreeData));

    for (const ev of events) {
      // Skip events for ignored paths.
      if (isIgnoredPath(ev.path)) {
        console.log('[WorkspaceWatcher] 🚫 Ignored path event:', ev.path);
        continue;
      }
      if (ev.fromPath && isIgnoredPath(ev.fromPath)) {
        console.log('[WorkspaceWatcher] 🚫 Ignored fromPath event:', ev.fromPath);
        continue;
      }

      const evPath = ev.path;
      console.log(`[WorkspaceWatcher] ⚙️ Handling event: ${ev.kind} | Path: ${evPath}${ev.fromPath ? ` | From: ${ev.fromPath}` : ''}`);

      switch (ev.kind) {
        case 'renamed': {
          if (!ev.fromPath) break;
          // Update open tab paths that matched the old path.
          store.set(updateTabsPathByPrefixAtom, { fromPath: ev.fromPath, toPath: evPath });
          // Refresh both the old and new parent dirs.
          parentDirsToRefresh.add(parentDir(ev.fromPath));
          parentDirsToRefresh.add(parentDir(evPath));
          break;
        }

        case 'removed': {
          // Mark matching tabs as ghost/deleted.
          store.set(markTabsDeletedByPrefixAtom, evPath);

          // Save active file content to draft if it's being deleted
          const activeTab = store.get(activeTabAtom);
          if (activeTab) {
            const normTabPath = normalise(activeTab.filePath);
            const normEvPath = normalise(evPath);
            if (normTabPath === normEvPath || normTabPath.startsWith(normEvPath + '/')) {
              const currentContent = store.get(activeFileContentAtom);
              if (currentContent !== null) {
                console.log('[WorkspaceWatcher] 💾 Auto-saving active file memory content to draft due to deletion:', activeTab.filePath);
                draftService.saveDraft(activeTab.filePath, currentContent).catch(err => {
                  console.error('[WorkspaceWatcher] ❌ Failed to auto-save draft for deleted active file:', err);
                });
              }
            }
          }

          // Remove deleted path and all its descendants from expandedFolders.
          const normDeleted = normalise(evPath);
          const newExpanded = new Set<string>();
          expandedFolders.forEach((folderPath) => {
            const n = normalise(folderPath);
            if (n !== normDeleted && !n.startsWith(normDeleted + '/')) {
              newExpanded.add(folderPath);
            }
          });
          if (newExpanded.size !== expandedFolders.size) {
            console.log('[WorkspaceWatcher] Pruning expanded folders. Old size:', expandedFolders.size, 'New size:', newExpanded.size);
            store.set(expandedFoldersAtom, newExpanded);
          }

          parentDirsToRefresh.add(parentDir(evPath));
          break;
        }

        case 'created':
        case 'modified': {
          // If a previously deleted file is recreated (e.g. git checkout), clear ghost state.
          store.set(restoreTabsByPrefixAtom, evPath);
          parentDirsToRefresh.add(parentDir(evPath));
          break;
        }
      }
    }

    // Refresh only parent directories that are already loaded in the file tree.
    for (const dir of parentDirsToRefresh) {
      const isLoaded = fileTreeData[dir] !== undefined;
      console.log(`[WorkspaceWatcher] 🔍 Parent dir refresh check: "${dir}" | Is loaded? ${isLoaded}`);
      if (isLoaded) {
        console.log(`[WorkspaceWatcher] 🔄 Triggering refresh for directory: "${dir}"`);
        store.set(refreshDirectoryAtom, dir).catch((err) => {
          console.warn('[WorkspaceWatcher] ⚠️ Failed to refresh dir:', dir, err);
        });
      }
    }
  }
}

