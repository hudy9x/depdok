import * as React from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { paneTreeAtom, collectLeafPanes } from '@/stores/PaneStore';
import { isFileExplorerVisibleAtom } from '@/features/FileExplorer/store';
import { PaneTree } from './PaneTree';
import { FileBox } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EditorWorkspace(): React.JSX.Element {
  const tree = useAtomValue(paneTreeAtom);
  const leafPanes = collectLeafPanes(tree);
  const [isFileExplorerVisible, setIsFileExplorerVisible] = useAtom(isFileExplorerVisibleAtom);

  // If no leaf panes have any tabs, show welcome/empty workspace UI
  const totalTabs = leafPanes.reduce((acc, pane) => acc + pane.tabs.length, 0);

  if (totalTabs === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-layout-chrome text-muted-foreground p-8 select-none">
        <div className="flex flex-col items-center gap-2 max-w-sm text-center">
          <div className="w-16 h-16 rounded-xl border-2 border-border/50 flex items-center justify-center bg-layout-content shadow-sm mb-2">
            <FileBox className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-1">No file open</h2>
          <p className="text-sm text-muted-foreground/80 mb-4">
            Select a file from the explorer to start editing or search your workspace.
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="default"
              onClick={() => {
                const event = new KeyboardEvent("keydown", {
                  key: "p",
                  metaKey: true,
                  bubbles: true,
                  cancelable: true
                });
                document.dispatchEvent(event);
              }}
            >
              Search files
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsFileExplorerVisible(!isFileExplorerVisible)}
            >
              {isFileExplorerVisible ? "Hide sidebar" : "Open sidebar"}
            </Button>
          </div>
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
