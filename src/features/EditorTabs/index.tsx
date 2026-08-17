import { useAtomValue } from 'jotai';

import { CustomScroller } from '@/components/CustomScroller';
import { isFileExplorerVisibleAtom } from '@/features/FileExplorer/store';
import { cn } from '@/lib/utils';
import { activeTabIdAtom, paneTabsAtomFamily, tabsAtom } from '@/stores/TabStore';
import { usePlatform } from '@/lib/platform';

import { CreateTabButton } from './CreateTabButton';
import { TabItem } from './TabItem';
import './EditorTabs.css';

interface EditorTabsProps {
  paneId?: string;
  isSidebarVisible?: boolean;
}

export function EditorTabs({ paneId, isSidebarVisible }: EditorTabsProps = {}) {
  const globalTabs = useAtomValue(tabsAtom);
  const paneTabs = useAtomValue(paneTabsAtomFamily(paneId || ''));
  const activeTabId = useAtomValue(activeTabIdAtom);
  const fileExplorerVisible = useAtomValue(isFileExplorerVisibleAtom);
  const isSidebarOpen = isSidebarVisible !== undefined ? isSidebarVisible : fileExplorerVisible;
  const tabs = paneId ? paneTabs : globalTabs;

  const { isMacOS } = usePlatform();

  const leftPaddingClass = isSidebarOpen
    ? 'pl-0'
    : (isMacOS ? 'pl-[148px]' : 'pl-[30px]');

  const rightPaddingClass = isMacOS ? 'pr-3' : 'pr-[142px]';

  return (
    <div
      data-tauri-drag-region
      className={cn(
        "depdok-tabs-container flex items-end pt-1.5 h-[38px] w-full shrink-0 overflow-hidden bg-layout-chrome",
        leftPaddingClass,
        rightPaddingClass
      )}
    >
      {/* Tabs list with horizontal scroll */}
      <CustomScroller
        orientation="horizontal"
        data-tauri-drag-region
        className="h-[38px] flex-1 min-w-0"
      >
        <div
          id="unified-tab-content-wrapper"
          data-tauri-drag-region
          className={cn(
            "depdok-tabs-wrapper flex w-max min-w-full space-x-0 h-full items-end pr-2",
            isSidebarOpen && "sidebar-open"
          )}
        >
          {tabs.map((tab, index) => {
            const isNextActive = tabs[index + 1]?.id === activeTabId;
            return (
              <div key={tab.id} data-tauri-drag-region="false" className="group flex-shrink-0">
                <TabItem
                  tab={tab}
                  paneId={paneId}
                  isNextActive={isNextActive}
                  isFirst={index === 0}
                />
              </div>
            );
          })}
          {/* Create button on the right of tabs */}
          <CreateTabButton />

          {/* Empty trailing space to allow window dragging on empty header */}
          <div data-tauri-drag-region className="flex-1 min-w-[32px] h-full" />
        </div>
      </CustomScroller>
    </div>
  );
}
