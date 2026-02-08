import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { listen } from '@tauri-apps/api/event';
import {
  workspaceRootAtom,
  openWorkspaceAtom,
  fileTreeDataAtom,
} from '../store';
import { openFolderDialog } from '../api';

export function useFileExplorerInitialization() {
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const fileTreeData = useAtomValue(fileTreeDataAtom);
  const openWorkspace = useSetAtom(openWorkspaceAtom);
  const hasLoadedRef = useRef(false);

  // Auto-load persisted workspace on mount
  useEffect(() => {
    if (workspaceRoot && !fileTreeData[workspaceRoot] && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      openWorkspace(workspaceRoot).catch((error) => {
        console.error('Failed to load persisted workspace:', error);
        hasLoadedRef.current = false;
      });
    }
  }, [workspaceRoot, fileTreeData, openWorkspace]);

  // Listen for menu event to open folder
  useEffect(() => {
    const unlisten = listen('menu://open-folder', async () => {
      const folderPath = await openFolderDialog();
      if (folderPath) {
        try {
          await openWorkspace(folderPath);
        } catch (error) {
          console.error('Failed to open workspace:', error);
        }
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [openWorkspace]);
}
