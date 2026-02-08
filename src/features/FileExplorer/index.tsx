import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { listen } from '@tauri-apps/api/event';
import {
  workspaceRootAtom,
  openWorkspaceAtom,
  isLoadingAtom,
  fileTreeDataAtom,
  selectedPathsAtom,
} from './store';
import { openFolderDialog } from './api';

import { useWindowDrag } from '@/hooks/useWindowDrag';
import { FileOperationDialogs } from './FileOperationDialogs';
import { useFileOperations } from './useFileOperations';
import { EmptyExplorer } from './EmptyExplorer';
import { ExplorerView } from './ExplorerView';

export function FileExplorer() {
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const isLoading = useAtomValue(isLoadingAtom);
  const fileTreeData = useAtomValue(fileTreeDataAtom);
  const openWorkspace = useSetAtom(openWorkspaceAtom);
  const hasLoadedRef = useRef(false);
  const dragRef = useWindowDrag();

  const selectedPaths = useAtomValue(selectedPathsAtom);
  const setSelectedPaths = useSetAtom(selectedPathsAtom);
  const { cut, copy, paste, deleteItems, clearClipboard } = useFileOperations();


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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!workspaceRoot) {
    return <EmptyExplorer />;
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Only handle if FileExplorer is focused (or we preventDefault to stop bubbling if handling global shortcuts, 
    // but better to rely on focus)
    // However, users expect to press Cmd+C when file explorer item is selected even if div isn't strictly focused?
    // If we use tabIndex=0, user must click plain area or item to focus.

    // Check modifiers
    const isCmdOrCtrl = e.metaKey || e.ctrlKey;

    if (isCmdOrCtrl) {
      switch (e.key) {
        case 'c':
          e.preventDefault();
          if (selectedPaths.size > 0) copy(Array.from(selectedPaths));
          break;
        case 'x':
          e.preventDefault();
          if (selectedPaths.size > 0) cut(Array.from(selectedPaths));
          break;
        case 'v':
          e.preventDefault();
          // Determine destination
          // If 1 item selected and is folder -> paste there
          // Else paste in parent of first selected item
          // Else paste in workspaceRoot
          let dest = workspaceRoot;
          if (selectedPaths.size === 1) {
            const path = Array.from(selectedPaths)[0];
            // simplified check: just try to paste in parent usually, or if folder.
            // We need to know if it's a folder. We can check fileTreeData or just assume passing path is fine if folder?
            // `paste` hook function takes `destinationFolder`.
            // We can't easily know if path is folder without looking up in tree or checking extension/metadata.
            // For now, let's look up in fileTreeData (but it maps folders -> entries, not easily reverse lookup).
            // Let's assume selecting a file -> paste in parent. Selecting a folder -> paste inside?
            // Actually, Windows Explorer: Paste always goes to current directory.
            // File Tree item selection usually implies "this is the target".
            // Let's use parent of selected item for safety, unless we implement robust isFolder check.
            // Actually, I can check if path is in `fileTreeData` keys (loaded folders) but that's partial.
            // Let's stick to parent folder of selected item to be safe and consistent with Context Menu "New File" logic default.
            // Wait, context menu "New File" logic: if folder, create inside.
            // I don't have `isFolder` here easily.
            // Let's try to infer from data or just paste in parent.
            dest = path.split(/[/\\]/).slice(0, -1).join('/') || workspaceRoot;
          } else if (selectedPaths.size > 0) {
            const first = Array.from(selectedPaths)[0];
            dest = first.split(/[/\\]/).slice(0, -1).join('/') || workspaceRoot;
          }
          if (dest) paste(dest);
          break;
      }
    } else {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Avoid deleting if renaming or input active?
        // But here we are on the div.
        if (selectedPaths.size > 0) {
          e.preventDefault();
          deleteItems(Array.from(selectedPaths));
        }
      } else if (e.key === 'Escape') {
        // Cancel cut/copy
        // We need a way to clear clipboard. 
        // We can use a new function from useFileOperations or just setAtom here.
        // Let's assume we update useFileOperations to return clearClipboard.
        // or just import clipboardAtom and set it to null.
        // But let's stick to useFileOperations abstraction if possible.
        // I'll update useFileOperations first or just do it here if I have access.
        // I don't have setClipboard exposed. I'll update useFileOperations.
        // For now, I'll allow it to fail compile and fix it in next step, or better, update useFileOperations first.
        // But I am in FileExplorer.tsx. Let's assume I will add `clearClipboard` to `useFileOperations`.
        e.preventDefault();
        clearClipboard();
        setSelectedPaths(new Set());
      }
    }
  };

  return (
    <div
      ref={dragRef as React.RefObject<HTMLDivElement>}
      className="flex flex-col h-full outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* <FileContextMenu path={workspaceRoot} isFolder={true}> */}
      <ExplorerView />
      {/* </FileContextMenu> */}
      <FileOperationDialogs />
    </div>
  );
}

