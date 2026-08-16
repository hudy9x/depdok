import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface TitlebarContainerProps {
  children: ReactNode;
  showBorder?: boolean;
  className?: string;
}

export function TitlebarContainer({ children, showBorder = false, className }: TitlebarContainerProps) {
  return (
    <div 
      data-tauri-drag-region 
      className={cn(
        "h-[38px] w-full flex items-center justify-between select-none z-50 bg-transparent",
        showBorder && "border-b border-border",
        className
      )}
    >
      {children}
    </div>
  );
}
