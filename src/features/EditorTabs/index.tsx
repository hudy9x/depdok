import { useAtomValue } from 'jotai';

import { paneTabsAtomFamily } from '@/stores/TabStore';
import { TabItem } from './TabItem';
import { CreateTabButton } from './CreateTabButton';
import { CustomScroller } from '@/components/CustomScroller';

interface EditorTabsProps {
  paneId: string;
}

export function EditorTabs({ paneId }: EditorTabsProps) {
  const tabs = useAtomValue(paneTabsAtomFamily(paneId));

  return (
    <div className="flex items-end pt-0 h-[35px] w-full overflow-hidden bg-layout-chrome">
      {/* Tabs list with horizontal scroll */}
      <CustomScroller
        orientation="horizontal"
        className="h-[35px] flex-1 min-w-0"
      >
        <div id={`tab-content-wrapper-${paneId}`} className="flex w-max space-x-0 h-full items-end">
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
