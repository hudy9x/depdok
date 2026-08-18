import React, { useState } from 'react';
import {
  Pencil,
  ChevronDown,
  Check,
} from 'lucide-react';
import { BorderLineStyle, BorderType } from '../core/types';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface BorderPickerProps {
  onApplyBorder: (type: BorderType, color?: string, style?: BorderLineStyle) => void;
  className?: string;
}

const BORDER_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#cccccc',
  '#ffffff', '#ef4444', '#f97316', '#f59e0b', '#10b981',
  '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899',
  '#b91c1c', '#c2410c', '#b45309', '#047857', '#1d4ed8',
];

const LINE_STYLES: { id: BorderLineStyle; label: string; preview: React.ReactNode }[] = [
  {
    id: 'thin',
    label: 'Thin',
    preview: <div className="w-16 h-0 border-t border-foreground" />,
  },
  {
    id: 'medium',
    label: 'Medium',
    preview: <div className="w-16 h-0 border-t-2 border-foreground" />,
  },
  {
    id: 'thick',
    label: 'Thick',
    preview: <div className="w-16 h-0 border-t-[3px] border-foreground" />,
  },
  {
    id: 'dashed',
    label: 'Dashed',
    preview: <div className="w-16 h-0 border-t border-dashed border-foreground" />,
  },
  {
    id: 'dotted',
    label: 'Dotted',
    preview: <div className="w-16 h-0 border-t border-dotted border-foreground" />,
  },
  {
    id: 'double',
    label: 'Double',
    preview: <div className="w-16 h-[3px] border-t border-b border-foreground" />,
  },
];

/* Custom 10 Border Preset Icons (20x20 SVGs matching Excel & Google Sheets) */
const BorderAllIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || 'w-4 h-4'}>
    <rect x="2.5" y="2.5" width="15" height="15" stroke="currentColor" strokeWidth="1.5" />
    <line x1="2.5" y1="10" x2="17.5" y2="10" stroke="currentColor" strokeWidth="1.5" />
    <line x1="10" y1="2.5" x2="10" y2="17.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const BorderInnerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || 'w-4 h-4'}>
    <rect x="2.5" y="2.5" width="15" height="15" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.4" />
    <line x1="2.5" y1="10" x2="17.5" y2="10" stroke="currentColor" strokeWidth="1.5" />
    <line x1="10" y1="2.5" x2="10" y2="17.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const BorderHorizontalInnerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || 'w-4 h-4'}>
    <rect x="2.5" y="2.5" width="15" height="15" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.4" />
    <line x1="10" y1="2.5" x2="10" y2="17.5" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.4" />
    <line x1="2.5" y1="10" x2="17.5" y2="10" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const BorderVerticalInnerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || 'w-4 h-4'}>
    <rect x="2.5" y="2.5" width="15" height="15" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.4" />
    <line x1="2.5" y1="10" x2="17.5" y2="10" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.4" />
    <line x1="10" y1="2.5" x2="10" y2="17.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const BorderOuterIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || 'w-4 h-4'}>
    <rect x="2.5" y="2.5" width="15" height="15" stroke="currentColor" strokeWidth="1.5" />
    <line x1="2.5" y1="10" x2="17.5" y2="10" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.3" />
    <line x1="10" y1="2.5" x2="10" y2="17.5" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.3" />
  </svg>
);

const BorderLeftIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || 'w-4 h-4'}>
    <rect x="2.5" y="2.5" width="15" height="15" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.35" />
    <line x1="2.5" y1="10" x2="17.5" y2="10" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.35" />
    <line x1="10" y1="2.5" x2="10" y2="17.5" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.35" />
    <line x1="2.5" y1="2" x2="2.5" y2="18" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const BorderTopIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || 'w-4 h-4'}>
    <rect x="2.5" y="2.5" width="15" height="15" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.35" />
    <line x1="2.5" y1="10" x2="17.5" y2="10" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.35" />
    <line x1="10" y1="2.5" x2="10" y2="17.5" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.35" />
    <line x1="2" y1="2.5" x2="18" y2="2.5" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const BorderRightIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || 'w-4 h-4'}>
    <rect x="2.5" y="2.5" width="15" height="15" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.35" />
    <line x1="2.5" y1="10" x2="17.5" y2="10" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.35" />
    <line x1="10" y1="2.5" x2="10" y2="17.5" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.35" />
    <line x1="17.5" y1="2" x2="17.5" y2="18" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const BorderBottomIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || 'w-4 h-4'}>
    <rect x="2.5" y="2.5" width="15" height="15" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.35" />
    <line x1="2.5" y1="10" x2="17.5" y2="10" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.35" />
    <line x1="10" y1="2.5" x2="10" y2="17.5" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.35" />
    <line x1="2.5" y1="17.5" x2="17.5" y2="17.5" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const BorderClearIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className || 'w-4 h-4'}>
    <rect x="2.5" y="2.5" width="15" height="15" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.4" />
    <line x1="2.5" y1="10" x2="17.5" y2="10" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.4" />
    <line x1="10" y1="2.5" x2="10" y2="17.5" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.4" />
  </svg>
);

export const BorderPicker: React.FC<BorderPickerProps> = ({ onApplyBorder, className }) => {
  const [open, setOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | undefined>(undefined);
  const [selectedStyle, setSelectedStyle] = useState<BorderLineStyle>('thin');

  const handleSelectBorderType = (type: BorderType) => {
    onApplyBorder(type, selectedColor, selectedStyle);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Borders"
          className={cn(
            'flex items-center gap-0.5 p-1.5 rounded hover:bg-muted/70 cursor-pointer transition-colors',
            open && 'bg-muted/70',
            className
          )}
        >
          <BorderAllIcon className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-auto p-2 text-xs z-[9999] shadow-lg rounded-lg border bg-popover text-popover-foreground select-none"
      >
        <div className="flex items-stretch gap-2.5">
          {/* Left Grid: 10 Border Action Icons in 2 rows of 5 */}
          <div className="grid grid-cols-5 gap-1.5">
            {/* Row 1 */}
            <button
              type="button"
              onClick={() => handleSelectBorderType('all')}
              title="All borders"
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted/80 border border-border/40 hover:border-border transition-colors cursor-pointer"
            >
              <BorderAllIcon className="w-4 h-4 text-foreground" />
            </button>

            <button
              type="button"
              onClick={() => handleSelectBorderType('inner')}
              title="Inner borders"
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted/80 border border-border/40 hover:border-border transition-colors cursor-pointer"
            >
              <BorderInnerIcon className="w-4 h-4 text-foreground" />
            </button>

            <button
              type="button"
              onClick={() => handleSelectBorderType('horizontal')}
              title="Horizontal borders"
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted/80 border border-border/40 hover:border-border transition-colors cursor-pointer"
            >
              <BorderHorizontalInnerIcon className="w-4 h-4 text-foreground" />
            </button>

            <button
              type="button"
              onClick={() => handleSelectBorderType('vertical')}
              title="Vertical borders"
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted/80 border border-border/40 hover:border-border transition-colors cursor-pointer"
            >
              <BorderVerticalInnerIcon className="w-4 h-4 text-foreground" />
            </button>

            <button
              type="button"
              onClick={() => handleSelectBorderType('outer')}
              title="Outer borders"
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted/80 border border-border/40 hover:border-border transition-colors cursor-pointer"
            >
              <BorderOuterIcon className="w-4 h-4 text-foreground" />
            </button>

            {/* Row 2 */}
            <button
              type="button"
              onClick={() => handleSelectBorderType('left')}
              title="Left border"
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted/80 border border-border/40 hover:border-border transition-colors cursor-pointer"
            >
              <BorderLeftIcon className="w-4 h-4 text-foreground" />
            </button>

            <button
              type="button"
              onClick={() => handleSelectBorderType('top')}
              title="Top border"
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted/80 border border-border/40 hover:border-border transition-colors cursor-pointer"
            >
              <BorderTopIcon className="w-4 h-4 text-foreground" />
            </button>

            <button
              type="button"
              onClick={() => handleSelectBorderType('right')}
              title="Right border"
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted/80 border border-border/40 hover:border-border transition-colors cursor-pointer"
            >
              <BorderRightIcon className="w-4 h-4 text-foreground" />
            </button>

            <button
              type="button"
              onClick={() => handleSelectBorderType('bottom')}
              title="Bottom border"
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted/80 border border-border/40 hover:border-border transition-colors cursor-pointer"
            >
              <BorderBottomIcon className="w-4 h-4 text-foreground" />
            </button>

            <button
              type="button"
              onClick={() => handleSelectBorderType('none')}
              title="Clear borders"
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted/80 border border-border/40 hover:border-border transition-colors cursor-pointer"
            >
              <BorderClearIcon className="w-4 h-4 text-foreground" />
            </button>
          </div>

          {/* Vertical Divider */}
          <div className="w-px bg-border/70 my-0.5" />

          {/* Right Section: Border Color & Border Line Style */}
          <div className="flex flex-col justify-between py-0.5 gap-1">
            {/* Border Color Picker */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="Border color"
                  className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-muted/70 border border-border/40 transition-colors cursor-pointer"
                >
                  <div className="flex flex-col items-center justify-center relative">
                    <Pencil className="w-3.5 h-3.5 text-foreground" />
                    <span
                      className="w-3.5 h-1 rounded-sm mt-0.5"
                      style={{
                        backgroundColor: selectedColor || 'var(--cell-border-solid, currentColor)',
                      }}
                    />
                  </div>
                  <ChevronDown className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="p-2 w-48 z-[10000]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground">Border Color</span>
                  <button
                    type="button"
                    onClick={() => setSelectedColor(undefined)}
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded hover:bg-muted font-medium transition-colors cursor-pointer',
                      selectedColor === undefined ? 'bg-primary/20 text-primary font-bold' : 'text-muted-foreground'
                    )}
                  >
                    Auto
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {BORDER_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={cn(
                        'w-6 h-6 rounded border border-border/80 hover:scale-110 transition-transform relative',
                        selectedColor === c && 'ring-2 ring-primary ring-offset-1'
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Border Line Style Picker */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="Border style"
                  className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-muted/70 border border-border/40 transition-colors cursor-pointer"
                >
                  <div className="w-4 flex flex-col items-center justify-center">
                    {selectedStyle === 'thin' && <div className="w-4 h-0 border-t border-foreground" />}
                    {selectedStyle === 'medium' && <div className="w-4 h-0 border-t-2 border-foreground" />}
                    {selectedStyle === 'thick' && <div className="w-4 h-0 border-t-[3px] border-foreground" />}
                    {selectedStyle === 'dashed' && <div className="w-4 h-0 border-t border-dashed border-foreground" />}
                    {selectedStyle === 'dotted' && <div className="w-4 h-0 border-t border-dotted border-foreground" />}
                    {selectedStyle === 'double' && <div className="w-4 h-[3px] border-t border-b border-foreground" />}
                  </div>
                  <ChevronDown className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36 text-xs z-[10000] p-1">
                <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1">Border Style</div>
                {LINE_STYLES.map((styleItem) => (
                  <DropdownMenuItem
                    key={styleItem.id}
                    onClick={() => setSelectedStyle(styleItem.id)}
                    className="flex items-center justify-between gap-2 py-1.5 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      {styleItem.preview}
                    </div>
                    {selectedStyle === styleItem.id && <Check className="w-3 h-3 text-primary shrink-0" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
