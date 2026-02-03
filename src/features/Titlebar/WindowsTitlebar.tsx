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
      <div className="absolute left-3 flex items-center gap-3">
        <img src="/app-icon.png" alt="App Icon" className="w-5 h-5" />
        {left}
      </div>

      {/* Center - Content */}
      <div data-tauri-drag-region className="ml-[28px] flex items-center justify-center h-full px-3 flex-1">
        {center || <span className="text-[13px] font-medium text-foreground/70 pointer-events-none">Depdok</span>}
      </div>

      {/* Right - Actions & Buttons */}
      <div className="absolute h-full right-0 flex items-center">
        <div className="flex items-center gap-2 mr-2">
          {right}
        </div>
        <WindowsButtons />
      </div>
    </TitlebarContainer>
  );
}
