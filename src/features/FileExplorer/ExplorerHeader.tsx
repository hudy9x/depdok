import { useAtomValue, useSetAtom } from 'jotai';
import { FilePlus, FolderPlus, SquareEqual } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  workspaceRootAtom,
  openCreateDialogAtom,
  expandedFoldersAtom
} from './store';

export function ExplorerHeader() {
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const openCreateDialog = useSetAtom(openCreateDialogAtom);
  const setExpandedFolders = useSetAtom(expandedFoldersAtom);

  const handleCreateFile = () => {
    if (workspaceRoot) {
      openCreateDialog({ path: workspaceRoot, type: 'file' });
    }
  };

  const handleCreateFolder = () => {
    if (workspaceRoot) {
      openCreateDialog({ path: workspaceRoot, type: 'folder' });
    }
  };

  const handleCollapseAll = () => {
    setExpandedFolders(new Set());
  };

  if (!workspaceRoot) return null;

  return (
    <div className="flex items-center justify-between px-2 py-1 shrink-0 group/explorer-header">
      <span className="text-xs font-semibold text-muted-foreground truncate" title={workspaceRoot}>
        {workspaceRoot.split(/[/\\]/).pop() || 'WORKSPACE'}
      </span>
      <div className="flex items-center gap-0.5 opacity-100 group-hover/explorer-header:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500" onClick={handleCreateFile} title="New File">
          <FilePlus className="!h-3.5 !w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500" onClick={handleCreateFolder} title="New Folder">
          <FolderPlus className="h-3.5 !w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500" onClick={handleCollapseAll} title="Collapse All">
          <SquareEqual className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
