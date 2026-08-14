import { useAtomValue } from 'jotai';

import { tabsAtom, paneTabsAtomFamily } from '@/stores/TabStore';
import { TabItem } from './TabItem';
import { CreateTabButton } from './CreateTabButton';
import { CustomScroller } from '@/components/CustomScroller';

interface EditorTabsProps {
  paneId?: string;
}

export function EditorTabs({ paneId }: EditorTabsProps = {}) {
  const globalTabs = useAtomValue(tabsAtom);
  const paneTabs = useAtomValue(paneTabsAtomFamily(paneId || ''));
  const tabs = paneId ? paneTabs : globalTabs;

  return (
    <div className="flex items-end pt-0 h-[35px] w-full shrink-0 overflow-hidden bg-layout-chrome border-b border-border/40">
      {/* Tabs list with horizontal scroll */}
      <CustomScroller
        orientation="horizontal"
        className="h-[35px] flex-1 min-w-0"
      >
        <div id="unified-tab-content-wrapper" className="flex w-max space-x-0 h-full items-end">
          {tabs.map((tab) => (
            <div key={tab.id} className="group flex-shrink-0">
              <TabItem tab={tab} paneId={paneId} />
            </div>
          ))}
          {/* Create button on the right of tabs */}
          <CreateTabButton />
        </div>
      </CustomScroller>
    </div>
  );
}
