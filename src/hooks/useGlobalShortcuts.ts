import { useEffect } from 'react';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { isFileExplorerVisibleAtom } from '@/features/FileExplorer/store';
import {
  activePaneIdAtom,
  paneTreeAtom,
  splitPaneAtom,
  focusPaneAtom,
  collectLeafPanes,
} from '@/stores/PaneStore';

export function useGlobalShortcuts() {
  const [, setIsFileExplorerVisible] = useAtom(isFileExplorerVisibleAtom);
  const activePaneId = useAtomValue(activePaneIdAtom);
  const tree = useAtomValue(paneTreeAtom);
  const splitPane = useSetAtom(splitPaneAtom);
  const focusPane = useSetAtom(focusPaneAtom);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + B to toggle File Explorer
      if (isCmdOrCtrl && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsFileExplorerVisible((prev) => !prev);
        return;
      }

      // Cmd/Ctrl + \ to split horizontally
      // Cmd/Ctrl + Shift + \ to split vertically
      if (isCmdOrCtrl && e.key === '\\') {
        e.preventDefault();
        const direction = e.shiftKey ? 'vertical' : 'horizontal';
        splitPane({ paneId: activePaneId, direction });
        return;
      }

      // Cmd/Ctrl + 1/2/3/4 to focus pane 1/2/3/4
      if (isCmdOrCtrl && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const paneIndex = parseInt(e.key, 10) - 1;
        const leaves = collectLeafPanes(tree);
        if (paneIndex >= 0 && paneIndex < leaves.length) {
          focusPane(leaves[paneIndex].id);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setIsFileExplorerVisible, activePaneId, tree, splitPane, focusPane]);
}
