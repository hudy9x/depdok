import { ReactNode } from 'react';
import { TitlebarContainer } from './TitlebarContainer';
import { MacOSButtons } from './MacOSButtons';

interface MacOSTitlebarProps {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}

export function MacOSTitlebar({ left, center, right }: MacOSTitlebarProps) {
  return (
    <TitlebarContainer>
      {/* Buttons - Left */}
      <div data-tauri-drag-region="false" className="flex items-center gap-3 pl-3 pr-2 flex-shrink-0">
        <MacOSButtons />
        {left}
      </div>

      {/* Center - Tabs area */}
      <div data-tauri-drag-region className="flex items-center justify-center h-full px-1 flex-1 min-w-0 overflow-hidden">
        {/* {center || <span className="text-[13px] font-medium text-foreground/70 pointer-events-none">Depdok</span>} */}
        {center}
      </div>

      {/* Right - Actions */}
      <div data-tauri-drag-region="false" className="titlebar-right flex items-center gap-2 pr-3 flex-shrink-0">
        {right}
      </div>
    </TitlebarContainer>
  );
}
