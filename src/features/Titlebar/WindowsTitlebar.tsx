import { ReactNode } from 'react';
import { TitlebarContainer } from './TitlebarContainer';
import { WindowsButtons } from './WindowsButtons';

interface WindowsTitlebarProps {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}

export function WindowsTitlebar({ left, center, right }: WindowsTitlebarProps) {
  return (
    <TitlebarContainer>
      {/* Left - Icon & Content */}
      <div className="flex items-center gap-3 pl-3 pr-2 flex-shrink-0">
        <img src="/app-icon.png" alt="App Icon" className="w-5 h-5 pointer-events-none" />
        {left}
      </div>

      {/* Center - Content */}
      <div data-tauri-drag-region className="flex items-center justify-center h-full px-1 flex-1 min-w-0 overflow-hidden">
        {center || <span className="text-[13px] font-medium text-foreground/70 pointer-events-none">Depdok</span>}
      </div>

      {/* Right - Actions & Buttons */}
      <div data-tauri-drag-region="false" className="flex h-full items-center flex-shrink-0">
        <div className="flex items-center gap-2 mr-2">
          {right}
        </div>
        <WindowsButtons />
      </div>
    </TitlebarContainer>
  );
}
