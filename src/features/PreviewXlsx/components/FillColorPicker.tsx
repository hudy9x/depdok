import React, { useRef, useState } from 'react';
import {
  Check,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface FillColorPickerProps {
  currentColor?: string;
  onApplyBgColor: (color: string) => void;
  className?: string;
}

// Exact Google Sheets 10x8 theme palette
const THEME_PALETTE: string[] = [
  // Row 1: Grayscale (10)
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
  // Row 2: Pure Hue (10)
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  // Row 3: Light tint 1 (10)
  '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
  // Row 4: Light tint 2 (10)
  '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
  // Row 5: Medium tint (10)
  '#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0',
  // Row 6: Deep tint (10)
  '#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79',
  // Row 7: Dark shade 1 (10)
  '#85200c', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75', '#741b47',
  // Row 8: Dark shade 2 (10)
  '#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130',
];

const STANDARD_COLORS: string[] = [
  '#000000', '#ffffff', '#4285f4', '#ea4335', '#fbbc04', '#34a853', '#ff6d01', '#46bdc6',
];

// Helper to determine if text/checkmark on color should be dark or light
const isLightColor = (hex: string): boolean => {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return true;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 140;
};

// Paint Bucket with Dripping Drop Icon matching Google Sheets
const PaintBucketDropIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className || 'w-3.5 h-3.5'}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z" style={{ display: 'none' }} />
    <path d="M16.56 8.94L7.62 0 6.21 1.41l2.38 2.38-5.15 5.15c-.59.59-.59 1.54 0 2.12l5.5 5.5c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.58.59-1.53 0-2.12zM5.21 10L10 5.21 14.79 10H5.21zM19 11.5s-2 2.17-2 3.5c0 1.1.9 2 2 2s2-.9 2-2c0-1.33-2-3.5-2-3.5z" />
  </svg>
);

// Reset / Slashed drop icon
const SlashedDropIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className || 'w-4 h-4'}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 2c-5.33 6-8 10-8 14 0 4.41 3.59 8 8 8s8-3.59 8-8c0-4-2.67-8-8-14zm0 20c-3.31 0-6-2.69-6-6 0-2.97 2.16-6.43 6-10.74 3.84 4.31 6 7.77 6 10.74 0 3.31-2.69 6-6 6z" style={{ display: 'none' }} />
    <path d="M2.81 2.81L1.39 4.22l3.41 3.41C4.31 8.87 4 10.36 4 12c0 4.42 3.58 8 8 8 1.64 0 3.13-.31 4.37-.8l3.41 3.41 1.41-1.41L2.81 2.81zM12 18c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8l8.1 8.1c-.83.45-1.79.7-2.8.7zm6.71-3.29l-1.42-1.42C17.72 12.63 18 11.96 18 11c0-3.31-6-9-6-9s-1.89 1.79-3.41 4.17l-1.42-1.42C8.68 3.09 12 0 12 0s8 6.58 8 12c0 1.01-.25 1.94-.71 2.71z" />
  </svg>
);

export const FillColorPicker: React.FC<FillColorPickerProps> = ({
  currentColor,
  onApplyBgColor,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const handleSelectColor = (color: string) => {
    onApplyBgColor(color);
    setOpen(false);
  };

  const handleReset = () => {
    onApplyBgColor('');
    setOpen(false);
  };

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleSelectColor(e.target.value);
  };

  const normalizedCurrent = currentColor?.toLowerCase();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Fill color"
          className={cn(
            'flex flex-col items-center justify-center p-1.5 rounded hover:bg-muted/70 cursor-pointer transition-colors relative',
            open && 'bg-muted/70',
            className
          )}
        >
          <PaintBucketDropIcon className="w-3.5 h-3.5 text-foreground" />
          <span
            className="w-3.5 h-1 rounded-sm mt-0.5"
            style={{
              backgroundColor: currentColor && currentColor !== 'transparent' ? currentColor : '#ffffff',
              border: !currentColor || currentColor === '#ffffff' ? '1px solid rgba(0,0,0,0.2)' : 'none',
            }}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-64 p-3 text-xs z-[9999] shadow-xl rounded-xl border bg-popover text-popover-foreground select-none"
      >
        <div className="flex flex-col gap-2.5">
          {/* Header with Reset Button */}
          <div className="flex items-center justify-between pb-1 border-b border-border/50">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted font-medium text-foreground transition-colors cursor-pointer w-full text-left"
            >
              <SlashedDropIcon className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-xs">Reset</span>
            </button>
          </div>

          {/* 10x8 Theme Color Palette */}
          <div className="grid grid-cols-10 gap-1 place-items-center">
            {THEME_PALETTE.map((c, index) => {
              const isSelected = normalizedCurrent === c.toLowerCase();
              const light = isLightColor(c);

              return (
                <button
                  key={`${c}-${index}`}
                  type="button"
                  onClick={() => handleSelectColor(c)}
                  className={cn(
                    'w-5 h-5 rounded-full border border-border/30 hover:scale-125 transition-transform flex items-center justify-center relative cursor-pointer',
                    c === '#ffffff' && 'border-border/70',
                    isSelected && 'ring-2 ring-primary ring-offset-1 z-10'
                  )}
                  style={{ backgroundColor: c }}
                  title={c}
                >
                  {isSelected && (
                    <Check
                      className="w-3 h-3 stroke-[3]"
                      style={{ color: light ? '#000000' : '#ffffff' }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Standard Colors Section */}
          <div className="pt-1.5 border-t border-border/50">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                Standard
              </span>
              <button
                type="button"
                onClick={() => colorInputRef.current?.click()}
                title="Custom color"
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <input
                ref={colorInputRef}
                type="color"
                value={currentColor || '#ffffff'}
                onChange={handleCustomColorChange}
                className="sr-only"
              />
            </div>

            <div className="flex items-center gap-1.5">
              {STANDARD_COLORS.map((c) => {
                const isSelected = normalizedCurrent === c.toLowerCase();
                const light = isLightColor(c);

                return (
                  <button
                    key={`std-${c}`}
                    type="button"
                    onClick={() => handleSelectColor(c)}
                    className={cn(
                      'w-5 h-5 rounded-full border border-border/30 hover:scale-125 transition-transform flex items-center justify-center relative cursor-pointer',
                      c === '#ffffff' && 'border-border/70',
                      isSelected && 'ring-2 ring-primary ring-offset-1 z-10'
                    )}
                    style={{ backgroundColor: c }}
                    title={c}
                  >
                    {isSelected && (
                      <Check
                        className="w-3 h-3 stroke-[3]"
                        style={{ color: light ? '#000000' : '#ffffff' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
