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
      {/* Buttons - Absolute Left */}
      <div className="absolute left-3 flex items-center gap-3">
        <MacOSButtons />
        {left}
      </div>

      {/* Center - Tabs area */}
      <div data-tauri-drag-region className="ml-[65px] flex items-center justify-center h-full px-3 flex-1">
        {/* {center || <span className="text-[13px] font-medium text-foreground/70 pointer-events-none">Depdok</span>} */}
        {center}
      </div>

      {/* Right - Actions */}
      <div className="titlebar-right absolute right-3 flex items-center gap-2">
        {right}
      </div>
    </TitlebarContainer>
  );
}
