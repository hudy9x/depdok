import { useEffect } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { load } from '@tauri-apps/plugin-store';
import { tabsAtom, activeTabIdAtom, Tab } from '@/stores/TabStore';
import { workspaceRootAtom, expandedFoldersAtom } from '@/features/FileExplorer/store';

export interface ProjectState {
  tabs: Tab[];
  activeTabId: string | null;
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
  const [tabs, setTabs] = useAtom(tabsAtom);
  const [activeTabId, setActiveTabId] = useAtom(activeTabIdAtom);
  const [expandedFolders, setExpandedFolders] = useAtom(expandedFoldersAtom);

  // Load project state when workspaceRoot changes
  useEffect(() => {
    if (!workspaceRoot) return;

    let isMounted = true;

    const loadState = async () => {
      try {
        const store = await getStore();
        const allProjects = await store.get<ProjectsStateMap>('depdok-projects-state') || {};
        const projectState = allProjects[workspaceRoot];

        if (isMounted && projectState) {
          // Note: Here we update the state directly but we have to be careful not to
          // trigger an immediate save loop. We just populate sessionStorage.
          setTabs(projectState.tabs || []);
          setActiveTabId(projectState.activeTabId || null);
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
  }, [workspaceRoot, setTabs, setActiveTabId, setExpandedFolders]);

  // Save project state when it changes
  useEffect(() => {
    if (!workspaceRoot) return;

    const saveState = async () => {
      try {
        const store = await getStore();
        const allProjects = await store.get<ProjectsStateMap>('depdok-projects-state') || {};
        
        const newState: ProjectState = {
          tabs,
          activeTabId,
          expandedFolders: Array.from(expandedFolders)
        };

        allProjects[workspaceRoot] = newState;
        await store.set('depdok-projects-state', allProjects);
        await store.save(); // Actually write to disk
      } catch (error) {
        console.error('Failed to save project state:', error);
      }
    };

    // Use a small timeout to debounce rapid changes (e.g. dragging tabs)
    const timeoutId = setTimeout(saveState, 500);
    return () => clearTimeout(timeoutId);
  }, [workspaceRoot, tabs, activeTabId, expandedFolders]);
}
