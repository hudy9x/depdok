import { useAtom } from 'jotai';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

import { tabsAtom } from '@/stores/TabStore';
import { ToggleButton } from '@/features/FileExplorer/ToggleButton';
import { TabItem } from './TabItem';
import { CreateTabButton } from './CreateTabButton';
import { CustomScroller } from '@/components/CustomScroller';
import { useWindowDrag } from '@/hooks/useWindowDrag';

export function EditorTabs() {
  const [tabs] = useAtom(tabsAtom);

  const styleBackButton = `w-8 h-[35px] p-2 cursor-pointer hover:opacity-90 hover:bg-background/100 opacity-90 border-x border-border flex-shrink-0`;

  useWindowDrag('[data-custom-scroller-content]');

  return (
    <div className="flex items-center h-[35px] w-full overflow-hidden" data-tauri-drag-region>
      {/* Back button on the left */}
      <Link to="/home">
        <ChevronLeft className={styleBackButton} />
      </Link>

      {/* FileExplorer toggle button */}
      <ToggleButton />

      {/* Tabs in the middle with horizontal scroll */}
      <CustomScroller
        orientation="horizontal"
        className="h-[35px]"
        style={{ width: 'calc(100vw - 280px)' }}
      >
        <div id="tab-content-wrapper" className="flex w-max space-x-0 h-full">
          {tabs.map((tab) => (
            <div key={tab.id} className="group flex-shrink-0">
              <TabItem tab={tab} />
            </div>
          ))}
          {/* Create button on the right */}
          <CreateTabButton />
        </div>
      </CustomScroller>

    </div>
  );
}
