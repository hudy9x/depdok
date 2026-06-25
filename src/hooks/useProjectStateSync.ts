import { useEffect } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { load } from '@tauri-apps/plugin-store';
import { paneTreeAtom, activePaneIdAtom, PaneNode } from '@/stores/PaneStore';
import { workspaceRootAtom, expandedFoldersAtom } from '@/features/FileExplorer/store';

export interface ProjectState {
  paneTree: PaneNode;
  activePaneId: string;
  expandedFolders: string[];
}

export type ProjectsStateMap = Record<string, ProjectState>;

let storePromise: ReturnType<typeof load> | null = null;
const getStore = () => {
  if (!storePromise) {
    storePromise = load('store.json', { autoSave: false } as any);
  }
  return storePromise;
};

export function useProjectStateSync() {
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const [paneTree, setPaneTree] = useAtom(paneTreeAtom);
  const [activePaneId, setActivePaneId] = useAtom(activePaneIdAtom);
  const [expandedFolders, setExpandedFolders] = useAtom(expandedFoldersAtom);

  // Load project state when workspaceRoot changes
  useEffect(() => {
    let isMounted = true;
    const projectKey = workspaceRoot || 'GLOBAL_WORKSPACE';

    const loadState = async () => {
      try {
        const store = await getStore();
        const allProjects = await store.get<ProjectsStateMap>('depdok-projects-state') || {};
        const projectState = allProjects[projectKey];

        if (isMounted && projectState) {
          if (projectState.paneTree) {
            setPaneTree(projectState.paneTree);
          }
          if (projectState.activePaneId) {
            setActivePaneId(projectState.activePaneId);
          }
          setExpandedFolders(new Set(projectState.expandedFolders || []));
        }
      } catch (error) {
        console.error('Failed to load project state:', error);
      }
    };

    loadState();

    return () => {
      isMounted = false;
    };
  }, [workspaceRoot, setPaneTree, setActivePaneId, setExpandedFolders]);

  // Save project state when it changes
  useEffect(() => {
    const projectKey = workspaceRoot || 'GLOBAL_WORKSPACE';

    const saveState = async () => {
      try {
        const store = await getStore();
        const allProjects = await store.get<ProjectsStateMap>('depdok-projects-state') || {};
        
        const newState: ProjectState = {
          paneTree,
          activePaneId,
          expandedFolders: Array.from(expandedFolders)
        };

        allProjects[projectKey] = newState;
        await store.set('depdok-projects-state', allProjects);
        await store.save(); // Actually write to disk
      } catch (error) {
        console.error('Failed to save project state:', error);
      }
    };

    // Use a small timeout to debounce rapid changes
    const timeoutId = setTimeout(saveState, 500);
    return () => clearTimeout(timeoutId);
  }, [workspaceRoot, paneTree, activePaneId, expandedFolders]);
}
