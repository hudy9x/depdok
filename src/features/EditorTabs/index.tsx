import { useAtom } from 'jotai';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

import { tabsAtom } from '@/stores/TabStore';
import { TabItem } from './TabItem';
import { CreateTabButton } from './CreateTabButton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useWindowDrag } from '@/hooks/useWindowDrag';

export function EditorTabs() {
  const [tabs] = useAtom(tabsAtom);



  const styleBackButton = `w-8 h-[35px] p-2 cursor-pointer hover:opacity-90 hover:bg-background/100 opacity-90 border-x border-border flex-shrink-0`;

  useWindowDrag('[data-radix-scroll-area-viewport]');

  return (
    <div className="ml-[65px] flex items-center h-[35px] w-full overflow-hidden" data-tauri-drag-region>
      {/* Back button on the left */}
      <Link to="/home">
        <ChevronLeft className={styleBackButton} />
      </Link>

      {/* Tabs in the middle with horizontal scroll */}
      <ScrollArea
        className="h-[35px] whitespace-nowrap overflow-hidden"
        style={{ width: 'calc(100vw - 280px)' }}
        data-tauri-drag-region
      >
        <div id="tab-content-wrapper" className="flex w-max space-x-0 h-full" data-tauri-drag-region>
          {tabs.map((tab) => (
            <div key={tab.id} className="group flex-shrink-0" data-tauri-drag-region>
              <TabItem tab={tab} />
            </div>
          ))}
          {/* Create button on the right */}
          <CreateTabButton />
        </div>
        <ScrollBar orientation="horizontal" className='h-2 hover:bg-background/50' />
      </ScrollArea>

    </div>
  );
}
