import { useAtomValue } from 'jotai';

import { CustomScroller } from '@/components/CustomScroller';
import { activeTabIdAtom, paneTabsAtomFamily, tabsAtom } from '@/stores/TabStore';

import { CreateTabButton } from './CreateTabButton';
import { TabItem } from './TabItem';
import './EditorTabs.css';

interface EditorTabsProps {
  paneId?: string;
}

export function EditorTabs({ paneId }: EditorTabsProps = {}) {
  const globalTabs = useAtomValue(tabsAtom);
  const paneTabs = useAtomValue(paneTabsAtomFamily(paneId || ''));
  const activeTabId = useAtomValue(activeTabIdAtom);
  const tabs = paneId ? paneTabs : globalTabs;

  return (
    <div className="depdok-tabs-container flex items-end pt-2  h-[38px] w-full shrink-0 overflow-hidden bg-layout-chrome">
      {/* Tabs list with horizontal scroll */}
      <CustomScroller
        orientation="horizontal"
        className="h-[38px] flex-1 min-w-0"
      >
        <div id="unified-tab-content-wrapper" className="depdok-tabs-wrapper flex w-max space-x-0 h-full items-end pr-2">
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
