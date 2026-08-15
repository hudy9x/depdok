import { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { platform } from '@tauri-apps/plugin-os';

import { CustomScroller } from '@/components/CustomScroller';
import { isFileExplorerVisibleAtom } from '@/features/FileExplorer/store';
import { cn } from '@/lib/utils';
import { activeTabIdAtom, paneTabsAtomFamily, tabsAtom } from '@/stores/TabStore';

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

  const [currentPlatform, setCurrentPlatform] = useState<string>('macos');

  useEffect(() => {
    try {
      const p = platform();
      setCurrentPlatform(p);
    } catch {
      // fallback in browser preview
    }
  }, []);

  const leftPaddingClass = isSidebarOpen
    ? 'pl-0'
    : (currentPlatform === 'macos' ? 'pl-[148px]' : 'pl-[112px]');

  const rightPaddingClass = currentPlatform === 'macos' ? 'pr-[165px]' : 'pr-[230px]';

  return (
    <div
      data-tauri-drag-region
      className={cn(
        "depdok-tabs-container flex items-end pt-1.5 h-[38px] w-full shrink-0 overflow-hidden bg-layout-chrome",
        rightPaddingClass
      )}
    >
      {/* Tabs list with horizontal scroll */}
      <CustomScroller
        orientation="horizontal"
        className="h-[38px] flex-1 min-w-0"
      >
        <div
          id="unified-tab-content-wrapper"
          className={cn(
            "depdok-tabs-wrapper flex w-max space-x-0 h-full items-end pr-2",
            leftPaddingClass
          )}
        >
          {tabs.map((tab, index) => {
            const isNextActive = tabs[index + 1]?.id === activeTabId;
            return (
              <div key={tab.id} className="group flex-shrink-0">
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
        </div>
      </CustomScroller>
    </div>
  );
}
