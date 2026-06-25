import { useAtomValue, useSetAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { createTabAtom } from '@/stores/TabStore';
import { splitPaneAtom, activePaneIdAtom } from '@/stores/PaneStore';
import { FileTree } from './FileTree';
import { ExplorerHeader } from './ExplorerHeader';
import {
  workspaceRootAtom,
} from './store';

export function ExplorerView() {
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const createTab = useSetAtom(createTabAtom);
  const splitPane = useSetAtom(splitPaneAtom);
  const activePaneId = useAtomValue(activePaneIdAtom);
  const navigate = useNavigate();

  const handleFileOpen = (filePath: string, options?: { isPreview?: boolean; isAltClick?: boolean }) => {
    const fileName = filePath.split(/[/\\]/).pop() || 'Untitled';
    if (options?.isAltClick) {
      splitPane({ paneId: activePaneId, direction: 'horizontal' });
    }
    createTab({ filePath, fileName, switchTo: true, isPreview: options?.isPreview });
    navigate('/editor');
  };

  if (!workspaceRoot) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ExplorerHeader />
      <FileTree onFileOpen={handleFileOpen} />
    </div>
  );
}
