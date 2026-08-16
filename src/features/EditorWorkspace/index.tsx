import * as React from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { FileBox } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EditorTabs } from '@/features/EditorTabs';
import { isFileExplorerVisibleAtom } from '@/features/FileExplorer/store';
import { cn } from '@/lib/utils';
import { paneTreeAtom } from '@/stores/PaneStore';
import { activeTabIdAtom, tabsAtom } from '@/stores/TabStore';

import { PaneTree } from './PaneTree';

export function EditorWorkspace(): React.JSX.Element {
  const tree = useAtomValue(paneTreeAtom);
  const tabs = useAtomValue(tabsAtom);
  const activeTabId = useAtomValue(activeTabIdAtom);
  const [isFileExplorerVisible, setIsFileExplorerVisible] = useAtom(isFileExplorerVisibleAtom);

  const isFirstTabActive = tabs.length > 0 && tabs[0]?.id === activeTabId;

  // If no tabs in workspace, show welcome/empty workspace UI
  if (tabs.length === 0) {
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
    <div
      className={cn(
        "w-full h-full relative overflow-hidden flex flex-col bg-layout-chrome",
        isFileExplorerVisible ? "pr-2 pb-2" : "px-2 pb-2"
      )}
    >
      <div className="relative z-10">
        <EditorTabs isSidebarVisible={isFileExplorerVisible} />
      </div>
      <div
        className={cn(
          "flex-1 min-h-0 min-w-0 relative bg-layout-content -mt-px border border-border overflow-hidden rounded-xl rounded-b-lg",
          isFirstTabActive && isFileExplorerVisible && "rounded-tl-none"
        )}
      >
        <PaneTree node={tree} />
      </div>
    </div>
  );
}
