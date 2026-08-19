import { useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CustomScroller } from '@/components/CustomScroller';
import { createTabAtom } from '@/stores/TabStore';
import { splitPaneAtom, activePaneIdAtom } from '@/stores/PaneStore';
import { FileTree } from './FileTree';
import { ExplorerHeader } from './ExplorerHeader';
import { ExplorerFooter } from './ExplorerFooter';
import {
  workspaceRootAtom,
} from './store';
import { isUnsupportedFile } from '@/lib/fileSupport';

export function ExplorerView() {
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const createTab = useSetAtom(createTabAtom);
  const splitPane = useSetAtom(splitPaneAtom);
  const activePaneId = useAtomValue(activePaneIdAtom);
  const navigate = useNavigate();
  const [scrollParent, setScrollParent] = useState<HTMLElement | null>(null);

  const handleFileOpen = (filePath: string, options?: { isPreview?: boolean; isAltClick?: boolean }) => {
    const fileName = filePath.split(/[/\\]/).pop() || 'Untitled';

    if (isUnsupportedFile(fileName)) {
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      toast.error(`Opening .${ext} files is not supported.`);
      return;
    }

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
      <CustomScroller
        orientation="vertical"
        className="flex-1 min-h-0"
        viewportRef={setScrollParent}
      >
        <FileTree
          onFileOpen={handleFileOpen}
          customScrollParent={scrollParent || undefined}
        />
      </CustomScroller>
      <ExplorerFooter />
    </div>
  );
}
