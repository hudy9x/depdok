import React from 'react';
import { cn } from '@/lib/utils';
import { type TocAnchor } from './MarkdownOutline';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Width (%) for each heading level 1–6
const LEVEL_WIDTHS: Record<number, string> = {
  1: '80%',
  2: '65%',
  3: '50%',
  4: '38%',
  5: '28%',
  6: '20%',
};

interface MarkdownOutlineMinimapProps {
  anchors: TocAnchor[];
  activeHeadingId?: string;
  onClick?: () => void;
  className?: string;
}

export const MarkdownOutlineMinimap: React.FC<MarkdownOutlineMinimapProps> = ({
  anchors,
  activeHeadingId,
  onClick,
  className,
}) => {
  if (anchors.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        onClick={onClick}
        className={cn(
          'flex flex-col items-end gap-2 w-[70px] px-2 py-2 rounded-md cursor-pointer group',
          'bg-background/80 backdrop-blur-sm',
          'hover:border-border transition-all duration-200',
          className
        )}
      >
        {anchors.map((anchor) => {
          const isActive = activeHeadingId === anchor.id;
          return (
            <Tooltip key={anchor.id}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    'h-[2px] rounded-full transition-all duration-200',
                    isActive
                      ? 'bg-foreground'
                      : 'bg-muted-foreground/30 group-hover:bg-muted-foreground/50'
                  )}
                  style={{ width: LEVEL_WIDTHS[anchor.level] ?? '30%' }}
                />
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={12}>
                <p>{anchor.textContent}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};
