import { useEffect, useRef } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { load } from '@tauri-apps/plugin-store';
import { paneTreeAtom, activePaneIdAtom, PaneNode } from '@/stores/PaneStore';
import {
  workspaceRootAtom,
  expandedFoldersAtom,
  isFileExplorerVisibleAtom,
} from '@/features/FileExplorer/store';
import { settingsService } from '@/lib/settings';

export interface ProjectState {
  paneTree: PaneNode;
  activePaneId: string;
  expandedFolders: string[];
  isFileExplorerVisible?: boolean;
}

export type ProjectsStateMap = Record<string, ProjectState>;

const DEFAULT_PANE_ID = 'pane-primary';
const DEFAULT_VIEW_MODE = settingsService.getSettings().viewMode || 'side-by-side';

const createDefaultProjectPaneTree = (): PaneNode => ({
  type: 'leaf',
  pane: {
    id: DEFAULT_PANE_ID,
    tabs: [],
    activeTabId: null,
    viewMode: DEFAULT_VIEW_MODE,
  },
});

let storePromise: ReturnType<typeof load> | null = null;
const getStore = () => {
  if (!storePromise) {
    storePromise = load('store.json', { autoSave: false } as any);
  }
  return storePromise;
};

import { localStorageDriver } from '@/lib/storage';

export async function readProjectsState(): Promise<ProjectsStateMap> {
  const local = localStorageDriver.getItem('depdok-projects-state', null);
  if (local) {
    return local;
  }
  try {
    const store = await getStore();
    const allProjects = await store.get<ProjectsStateMap>('depdok-projects-state') || {};
    if (Object.keys(allProjects).length > 0) {
      localStorageDriver.setItem('depdok-projects-state', allProjects);
    }
    return allProjects;
  } catch (err) {
    console.error('Failed to read projects state from store.json:', err);
    return {};
  }
}

export function writeProjectsState(allProjects: ProjectsStateMap): void {
  localStorageDriver.setItem('depdok-projects-state', allProjects);
  // Async background sync to store.json without blocking UI
  getStore().then(async (store) => {
    try {
      await store.set('depdok-projects-state', allProjects);
      await store.save();
    } catch (err) {
      console.error('Background store.json sync error:', err);
    }
  }).catch(() => {});
}

export function useProjectStateSync() {
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const [paneTree, setPaneTree] = useAtom(paneTreeAtom);
  const [activePaneId, setActivePaneId] = useAtom(activePaneIdAtom);
  const [expandedFolders, setExpandedFolders] = useAtom(expandedFoldersAtom);
  const [isFileExplorerVisible, setIsFileExplorerVisible] = useAtom(isFileExplorerVisibleAtom);
  const isHydratingRef = useRef(false);
  const hydratedProjectKeyRef = useRef<string | null>(null);

  // Load project state when workspaceRoot changes
  useEffect(() => {
    let isMounted = true;
    const projectKey = workspaceRoot || 'GLOBAL_WORKSPACE';
    isHydratingRef.current = true;
    hydratedProjectKeyRef.current = null;

    const loadState = async () => {
      try {
        const allProjects = await readProjectsState();
        const projectState = allProjects[projectKey];

        if (!isMounted) {
          return;
        }

        if (projectState) {
          if (projectState.paneTree) {
            setPaneTree(projectState.paneTree);
          }
          if (projectState.activePaneId) {
            setActivePaneId(projectState.activePaneId);
          }
          setExpandedFolders(new Set(projectState.expandedFolders || []));
          if (typeof projectState.isFileExplorerVisible === 'boolean') {
            setIsFileExplorerVisible(projectState.isFileExplorerVisible);
          }
        } else {
          // Project has no persisted state yet: start from a clean layout
          // to avoid leaking tabs/panels from the previously opened project.
          setPaneTree(createDefaultProjectPaneTree());
          setActivePaneId(DEFAULT_PANE_ID);
          setExpandedFolders(new Set(workspaceRoot ? [workspaceRoot] : []));
          setIsFileExplorerVisible(false);
        }
      } catch (error) {
        console.error('Failed to load project state:', error);
      } finally {
        if (isMounted) {
          hydratedProjectKeyRef.current = projectKey;
          isHydratingRef.current = false;
        }
      }
    };

    loadState();

    return () => {
      isMounted = false;
    };
  }, [workspaceRoot, setPaneTree, setActivePaneId, setExpandedFolders, setIsFileExplorerVisible]);

  // Save project state when it changes
  useEffect(() => {
    const projectKey = workspaceRoot || 'GLOBAL_WORKSPACE';

    // Prevent a race where switching workspace saves the previous project's
    // pane/tab state into the new project key before hydration finishes.
    if (isHydratingRef.current || hydratedProjectKeyRef.current !== projectKey) {
      return;
    }

    const saveState = async () => {
      try {
        const allProjects = await readProjectsState();
        
        const newState: ProjectState = {
          paneTree,
          activePaneId,
          expandedFolders: Array.from(expandedFolders),
          isFileExplorerVisible,
        };

        allProjects[projectKey] = newState;
        writeProjectsState(allProjects);
      } catch (error) {
        console.error('Failed to save project state:', error);
      }
    };

    // Use a small timeout to debounce rapid changes
    const timeoutId = setTimeout(saveState, 500);
    return () => clearTimeout(timeoutId);
  }, [workspaceRoot, paneTree, activePaneId, expandedFolders, isFileExplorerVisible]);
}
