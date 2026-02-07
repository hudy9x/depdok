import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { listen } from '@tauri-apps/api/event';
import { FolderOpen } from 'lucide-react';
import { FileTree } from './FileTree';
import { workspaceRootAtom, openWorkspaceAtom, isLoadingAtom, fileTreeDataAtom } from './store';
import { openFolderDialog } from './api';
import { createTabAtom } from '@/stores/TabStore';
import { Button } from '@/components/ui/button';

import { useNavigate } from 'react-router-dom';
import { useWindowDrag } from '@/hooks/useWindowDrag';

export function FileExplorer() {
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const isLoading = useAtomValue(isLoadingAtom);
  const fileTreeData = useAtomValue(fileTreeDataAtom);
  const openWorkspace = useSetAtom(openWorkspaceAtom);
  const createTab = useSetAtom(createTabAtom);
  const navigate = useNavigate();
  const hasLoadedRef = useRef(false);
  const dragRef = useWindowDrag();

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

  const handleFileOpen = (filePath: string) => {
    const fileName = filePath.split(/[/\\]/).pop() || 'Untitled';
    createTab({ filePath, fileName, switchTo: true });
    navigate('/editor');
  };

  const handleOpenFolder = async () => {
    const folderPath = await openFolderDialog();
    if (folderPath) {
      try {
        await openWorkspace(folderPath);
      } catch (error) {
        console.error('Failed to open workspace:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!workspaceRoot) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-4">
        <FolderOpen className="w-12 h-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground text-center">
          No folder opened
        </p>
        <Button onClick={handleOpenFolder} variant="outline" size="sm">
          Open Folder
        </Button>
      </div>
    );
  }

  return (
    <div ref={dragRef as React.RefObject<HTMLDivElement>} className="flex flex-col h-full">
      <FileTree onFileOpen={handleFileOpen} />
    </div>
  );
}
