import { useAtomValue } from 'jotai';

import { EditorTabs } from '@/features/EditorTabs';
import { isFileExplorerVisibleAtom } from '@/features/FileExplorer/store';
import { cn } from '@/lib/utils';
import { paneTreeAtom } from '@/stores/PaneStore';
import { activeTabIdAtom, tabsAtom } from '@/stores/TabStore';

import { PaneTree } from './PaneTree';
import { WorkspaceOnboarding } from './WorkspaceOnboarding';

export function EditorWorkspace(): React.JSX.Element {
  const tree = useAtomValue(paneTreeAtom);
  const tabs = useAtomValue(tabsAtom);
  const activeTabId = useAtomValue(activeTabIdAtom);
  const isFileExplorerVisible = useAtomValue(isFileExplorerVisibleAtom);

  const isFirstTabActive = tabs.length > 0 && tabs[0]?.id === activeTabId;

  // If no tabs in workspace, show onboarding/empty workspace UI
  if (tabs.length === 0) {
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
            "flex-1 min-h-0 min-w-0 relative bg-layout-content -mt-px border border-border overflow-hidden rounded-xl rounded-b-lg"
          )}
        >
          <WorkspaceOnboarding />
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
