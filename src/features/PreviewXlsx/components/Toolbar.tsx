import React from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  DollarSign,
  Percent,
  Palette,
  Check,
  ChevronDown,
  MoreHorizontal,
  Type,
} from 'lucide-react';
import { CellStyle, BorderLineStyle, BorderType } from '../core/types';
import { cn } from '@/lib/utils';
import { BorderPicker } from './BorderPicker';
import { FillColorPicker } from './FillColorPicker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  activeStyle?: CellStyle;
  activeNumFmt?: string;
  onApplyStyle: (style: Partial<CellStyle>) => void;
  onApplyFormat: (numFmt: string) => void;
  onApplyBorder?: (type: BorderType, color?: string, style?: BorderLineStyle) => void;
}

const COLOR_PALETTE = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#f59e0b',
  '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7',
  '#f43f5e', '#64748b', '#cbd5e1', '#fecdd3', '#fed7aa',
  '#fef08a', '#bbf7d0', '#bae6fd', '#bfdbfe', '#e9d5ff',
];

export const Toolbar: React.FC<ToolbarProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  activeStyle = {},
  activeNumFmt = 'General',
  onApplyStyle,
  onApplyFormat,
  onApplyBorder,
}) => {
  const currentAlignIcon = () => {
    if (activeStyle.align === 'center') return <AlignCenter className="w-3.5 h-3.5" />;
    if (activeStyle.align === 'right') return <AlignRight className="w-3.5 h-3.5" />;
    return <AlignLeft className="w-3.5 h-3.5" />;
  };

  const FormatMenuContent = () => (
    <DropdownMenuContent align="start" className="w-52 text-xs z-[9999]">
      <DropdownMenuItem onClick={() => onApplyFormat('General')}>General</DropdownMenuItem>
      <DropdownMenuItem onClick={() => onApplyFormat('#,##0.00')}>Number (1,234.56)</DropdownMenuItem>
      <DropdownMenuItem onClick={() => onApplyFormat('$#,##0.00')}>Currency ($1,234.56)</DropdownMenuItem>
      <DropdownMenuItem onClick={() => onApplyFormat('0.0%')}>Percentage (12.3%)</DropdownMenuItem>
      <DropdownMenuItem onClick={() => onApplyFormat('YYYY-MM-DD')}>Date (YYYY-MM-DD)</DropdownMenuItem>
      <DropdownMenuItem onClick={() => onApplyFormat('YYYY-MM-DD HH:mm:ss')}>Date Time (YYYY-MM-DD HH:mm:ss)</DropdownMenuItem>
      <DropdownMenuItem onClick={() => onApplyFormat('HH:mm:ss')}>Time (HH:mm:ss)</DropdownMenuItem>
      <DropdownMenuItem onClick={() => onApplyFormat('@')}>Plain Text</DropdownMenuItem>
    </DropdownMenuContent>
  );

  return (
    <div className="depdok-spreadsheet-toolbar-container w-full">
      <div className="flex items-center flex-nowrap gap-1 px-2 py-1 bg-background/95 border-b border-border/70 text-foreground text-xs select-none overflow-x-hidden">
        {/* History Controls */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo (Ctrl+Z / Cmd+Z)"
            className="p-1.5 rounded hover:bg-muted/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            title="Redo (Ctrl+Y / Cmd+Y)"
            className="p-1.5 rounded hover:bg-muted/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-4 w-px bg-border/80 mx-0.5 shrink-0" />

        {/* Number Formatting - Expanded View */}
        <div className="format-expanded items-center gap-1 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 px-2 py-1 bg-muted/40 hover:bg-muted/70 rounded border border-border/60 text-xs font-medium cursor-pointer transition-colors max-w-[130px]"
              >
                <span className="truncate">{activeNumFmt || 'General'}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-60 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <FormatMenuContent />
          </DropdownMenu>

          <button
            type="button"
            onClick={() => onApplyFormat('$#,##0.00')}
            title="Format as Currency"
            className="p-1.5 rounded hover:bg-muted/70 transition-colors"
          >
            <DollarSign className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onApplyFormat('0.0%')}
            title="Format as Percent"
            className="p-1.5 rounded hover:bg-muted/70 transition-colors"
          >
            <Percent className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Number Formatting - Collapsed View (< 600px) */}
        <div className="format-collapsed items-center shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 px-2 py-1 bg-muted/40 hover:bg-muted/70 rounded border border-border/60 text-xs font-medium cursor-pointer transition-colors max-w-[100px]"
              >
                <span className="truncate">{activeNumFmt || 'General'}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-60 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <FormatMenuContent />
          </DropdownMenu>
        </div>

        <div className="h-4 w-px bg-border/80 mx-0.5 shrink-0 toolbar-divider-styles" />

        {/* Text Styles - Expanded View */}
        <div className="text-styles-expanded items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onApplyStyle({ bold: !activeStyle.bold })}
            title="Bold (Cmd+B)"
            className={cn(
              'p-1.5 rounded transition-colors',
              activeStyle.bold ? 'bg-primary/20 text-primary font-bold' : 'hover:bg-muted/70'
            )}
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onApplyStyle({ italic: !activeStyle.italic })}
            title="Italic (Cmd+I)"
            className={cn(
              'p-1.5 rounded transition-colors',
              activeStyle.italic ? 'bg-primary/20 text-primary italic' : 'hover:bg-muted/70'
            )}
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onApplyStyle({ underline: !activeStyle.underline })}
            title="Underline (Cmd+U)"
            className={cn(
              'p-1.5 rounded transition-colors',
              activeStyle.underline ? 'bg-primary/20 text-primary underline' : 'hover:bg-muted/70'
            )}
          >
            <Underline className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onApplyStyle({ strike: !activeStyle.strike })}
            title="Strikethrough"
            className={cn(
              'p-1.5 rounded transition-colors',
              activeStyle.strike ? 'bg-primary/20 text-primary line-through' : 'hover:bg-muted/70'
            )}
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Text Styles - Collapsed View (< 760px) */}
        <div className="text-styles-collapsed items-center shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Text Styles"
                className={cn(
                  'flex items-center gap-0.5 p-1.5 rounded transition-colors',
                  activeStyle.bold || activeStyle.italic || activeStyle.underline || activeStyle.strike
                    ? 'bg-primary/20 text-primary font-bold'
                    : 'hover:bg-muted/70'
                )}
              >
                <Bold className="w-3.5 h-3.5" />
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-36 text-xs z-[9999]">
              <DropdownMenuItem
                onClick={() => onApplyStyle({ bold: !activeStyle.bold })}
                className="justify-between"
              >
                <span className="font-bold">Bold</span>
                {activeStyle.bold && <Check className="w-3 h-3 text-primary" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onApplyStyle({ italic: !activeStyle.italic })}
                className="justify-between"
              >
                <span className="italic">Italic</span>
                {activeStyle.italic && <Check className="w-3 h-3 text-primary" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onApplyStyle({ underline: !activeStyle.underline })}
                className="justify-between"
              >
                <span className="underline">Underline</span>
                {activeStyle.underline && <Check className="w-3 h-3 text-primary" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onApplyStyle({ strike: !activeStyle.strike })}
                className="justify-between"
              >
                <span className="line-through">Strikethrough</span>
                {activeStyle.strike && <Check className="w-3 h-3 text-primary" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="h-4 w-px bg-border/80 mx-0.5 shrink-0 toolbar-divider-colors" />

        {/* Colors - Expanded View */}
        <div className="colors-expanded items-center gap-0.5 shrink-0">
          {/* Text Color Picker */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Text Color"
                className="flex items-center justify-center p-1.5 rounded hover:bg-muted/70 relative cursor-pointer"
              >
                <span className="font-bold text-xs" style={{ color: activeStyle.color || 'currentColor' }}>
                  A
                </span>
                <span
                  className="absolute bottom-1 left-1.5 right-1.5 h-0.5"
                  style={{ backgroundColor: activeStyle.color || '#000000' }}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="p-2 w-44 z-[9999]">
              <div className="text-[11px] font-semibold text-muted-foreground mb-1">Text Color</div>
              <div className="grid grid-cols-5 gap-1">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onApplyStyle({ color: c })}
                    className="w-6 h-6 rounded border border-border/80 hover:scale-110 transition-transform"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Background / Fill Color Picker */}
          <FillColorPicker
            currentColor={activeStyle.bgColor}
            onApplyBgColor={(bgColor) => onApplyStyle({ bgColor })}
          />

          {/* Border Picker */}
          {onApplyBorder && (
            <BorderPicker onApplyBorder={onApplyBorder} />
          )}
        </div>

        {/* Colors - Collapsed View (< 600px) */}
        <div className="colors-collapsed items-center gap-0.5 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Text Color"
                className="flex items-center gap-0.5 p-1.5 rounded hover:bg-muted/70 relative cursor-pointer"
              >
                <Palette className="w-3.5 h-3.5 text-primary" />
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 p-2 text-xs z-[9999]">
              <div className="text-[11px] font-semibold text-muted-foreground mb-1">Text Color</div>
              <div className="grid grid-cols-5 gap-1">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onApplyStyle({ color: c })}
                    className="w-6 h-6 rounded border border-border/80 hover:scale-110 transition-transform"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Background / Fill Color Picker */}
          <FillColorPicker
            currentColor={activeStyle.bgColor}
            onApplyBgColor={(bgColor) => onApplyStyle({ bgColor })}
          />

          {/* Border Picker */}
          {onApplyBorder && (
            <BorderPicker onApplyBorder={onApplyBorder} />
          )}
        </div>

        <div className="h-4 w-px bg-border/80 mx-0.5 shrink-0 toolbar-divider-align" />

        {/* Alignments - Expanded View */}
        <div className="alignments-expanded items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onApplyStyle({ align: 'left' })}
            title="Align Left"
            className={cn(
              'p-1.5 rounded transition-colors',
              activeStyle.align === 'left' || !activeStyle.align ? 'bg-primary/20 text-primary' : 'hover:bg-muted/70'
            )}
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onApplyStyle({ align: 'center' })}
            title="Align Center"
            className={cn(
              'p-1.5 rounded transition-colors',
              activeStyle.align === 'center' ? 'bg-primary/20 text-primary' : 'hover:bg-muted/70'
            )}
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onApplyStyle({ align: 'right' })}
            title="Align Right"
            className={cn(
              'p-1.5 rounded transition-colors',
              activeStyle.align === 'right' ? 'bg-primary/20 text-primary' : 'hover:bg-muted/70'
            )}
          >
            <AlignRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Alignments - Collapsed View (< 760px) */}
        <div className="alignments-collapsed items-center shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Text Alignment"
                className="flex items-center gap-0.5 p-1.5 rounded hover:bg-muted/70 transition-colors"
              >
                {currentAlignIcon()}
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-36 text-xs z-[9999]">
              <DropdownMenuItem
                onClick={() => onApplyStyle({ align: 'left' })}
                className="gap-2 justify-between"
              >
                <div className="flex items-center gap-2">
                  <AlignLeft className="w-3.5 h-3.5" />
                  <span>Left</span>
                </div>
                {(activeStyle.align === 'left' || !activeStyle.align) && <Check className="w-3 h-3 text-primary" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onApplyStyle({ align: 'center' })}
                className="gap-2 justify-between"
              >
                <div className="flex items-center gap-2">
                  <AlignCenter className="w-3.5 h-3.5" />
                  <span>Center</span>
                </div>
                {activeStyle.align === 'center' && <Check className="w-3 h-3 text-primary" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onApplyStyle({ align: 'right' })}
                className="gap-2 justify-between"
              >
                <div className="flex items-center gap-2">
                  <AlignRight className="w-3.5 h-3.5" />
                  <span>Right</span>
                </div>
                {activeStyle.align === 'right' && <Check className="w-3 h-3 text-primary" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Ultra-compact Combined Dropdown (< 350px) */}
        <div className="toolbar-combined-dropdown items-center shrink-0 ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="More formatting"
                className="flex items-center gap-0.5 p-1.5 rounded bg-muted/40 hover:bg-muted/70 border border-border/60 transition-colors"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 text-xs z-[9999]">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2">
                  <Type className="w-3.5 h-3.5" />
                  <span>Styles</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-36 text-xs z-[9999]">
                  <DropdownMenuItem onClick={() => onApplyStyle({ bold: !activeStyle.bold })}>
                    <span className="font-bold">Bold</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onApplyStyle({ italic: !activeStyle.italic })}>
                    <span className="italic">Italic</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onApplyStyle({ underline: !activeStyle.underline })}>
                    <span className="underline">Underline</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onApplyStyle({ strike: !activeStyle.strike })}>
                    <span className="line-through">Strike</span>
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2">
                  <AlignLeft className="w-3.5 h-3.5" />
                  <span>Align</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-36 text-xs z-[9999]">
                  <DropdownMenuItem onClick={() => onApplyStyle({ align: 'left' })}>Left</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onApplyStyle({ align: 'center' })}>Center</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onApplyStyle({ align: 'right' })}>Right</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2">
                  <Palette className="w-3.5 h-3.5" />
                  <span>Colors</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="p-2 w-44 z-[9999]">
                  <div className="text-[11px] font-semibold text-muted-foreground mb-1">Color Palette</div>
                  <div className="grid grid-cols-5 gap-1">
                    {COLOR_PALETTE.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => onApplyStyle({ color: c })}
                        className="w-6 h-6 rounded border border-border/80 hover:scale-110 transition-transform"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};

