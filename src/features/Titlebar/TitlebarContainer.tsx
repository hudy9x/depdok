import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface TitlebarContainerProps {
  children: ReactNode;
}

export function TitlebarContainer({ children }: TitlebarContainerProps) {
  return (
    <div 
      data-tauri-drag-region 
      className={cn(
        "h-[35px] w-full flex items-center justify-between select-none z-[9999] border-b border-border",
        "bg-layout-chrome shrink-0"
      )}
    >
      {children}
    </div>
  );
}
