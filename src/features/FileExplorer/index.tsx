import { useAtomValue } from 'jotai';
import {
  workspaceRootAtom,
  isLoadingAtom,
} from './store';

import { FileOperationDialogs } from './FileOperationDialogs';
import { EmptyExplorer } from './EmptyExplorer';
import { ExplorerView } from './ExplorerView';
import { useFileExplorerInitialization } from './hooks/useFileExplorerInitialization';
import { useFileExplorerShortcuts } from './hooks/useFileExplorerShortcuts';

export function FileExplorer() {
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const isLoading = useAtomValue(isLoadingAtom);
  // Initialize file explorer (load workspace, listen for events)
  useFileExplorerInitialization();

  // Get keyboard shortcuts handler
  const { handleKeyDown } = useFileExplorerShortcuts();

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

  return (
    <div
      className="flex flex-col h-full outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <ExplorerView />
      <FileOperationDialogs />
    </div>
  );
}

