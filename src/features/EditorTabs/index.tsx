import { useAtom } from 'jotai';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { tabsAtom } from '@/stores/TabStore';
import { TabItem } from './TabItem';
import { CreateTabButton } from './CreateTabButton';

export function EditorTabs() {
  const [tabs] = useAtom(tabsAtom);

  const styleBackButton = `w-8 h-[35px] p-2 cursor-pointer hover:opacity-90 hover:bg-background/100 opacity-90 border-x border-border flex-shrink-0`;

  return (
    <div className="ml-[65px] flex items-center h-[35px] w-full overflow-hidden" data-tauri-drag-region>
      {/* Back button on the left */}
      <Link to="/">
        <ChevronLeft className={styleBackButton} />
      </Link>

      {/* Tabs in the middle with horizontal scroll */}
      <div className="flex items-center flex-1 overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent" data-tauri-drag-region>
        {tabs.map((tab) => (
          <div key={tab.id} className="group flex-shrink-0" data-tauri-drag-region>
            <TabItem tab={tab} />
          </div>
        ))}
        {/* Create button on the right */}
        <CreateTabButton />

      </div>

    </div>
  );
}
