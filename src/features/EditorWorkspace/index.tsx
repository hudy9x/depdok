import * as React from 'react';
import { useAtomValue } from 'jotai';
import { paneTreeAtom, collectLeafPanes } from '@/stores/PaneStore';
import { PaneTree } from './PaneTree';

export function EditorWorkspace(): React.JSX.Element {
  const tree = useAtomValue(paneTreeAtom);
  const leafPanes = collectLeafPanes(tree);

  // If no leaf panes have any tabs, show welcome/empty workspace UI
  const totalTabs = leafPanes.reduce((acc, pane) => acc + pane.tabs.length, 0);

  if (totalTabs === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-layout-chrome text-muted-foreground p-8 select-none">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <img src="/app-icon.png" alt="App Icon" className="w-16 h-16 opacity-20 grayscale" />
          <p className="text-xs">Select a file from the explorer to start editing or create a new file.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden flex bg-layout-content">
      <PaneTree node={tree} />
    </div>
  );
}
