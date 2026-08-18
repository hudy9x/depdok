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
  Plus,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { CellStyle } from '../core/types';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  onClear: (clearStyles?: boolean) => void;
  onInsertRow: () => void;
  onDeleteRow: () => void;
  onInsertCol: () => void;
  onDeleteCol: () => void;
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
  onClear,
  onInsertRow,
  onDeleteRow,
  onInsertCol,
  onDeleteCol,
}) => {
  return (
    <div className="flex items-center flex-wrap gap-1 px-2 py-1 bg-background/95 border-b border-border/70 text-foreground text-xs select-none">
      {/* History Controls */}
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

      <div className="h-4 w-px bg-border/80 mx-1" />

      {/* Number Formatting Preset Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 bg-muted/40 hover:bg-muted/70 rounded border border-border/60 text-xs font-medium cursor-pointer transition-colors"
          >
            <span>{activeNumFmt || 'General'}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-36 text-xs z-[9999]">
          <DropdownMenuItem onClick={() => onApplyFormat('General')}>General</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onApplyFormat('#,##0.00')}>Number (1,234.56)</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onApplyFormat('$#,##0.00')}>Currency ($1,234.56)</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onApplyFormat('0.0%')}>Percentage (12.3%)</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onApplyFormat('YYYY-MM-DD')}>Date (YYYY-MM-DD)</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onApplyFormat('@')}>Plain Text</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Quick Format Shortcuts */}
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

      <div className="h-4 w-px bg-border/80 mx-1" />

      {/* Text Styles */}
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

      <div className="h-4 w-px bg-border/80 mx-1" />

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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Fill Color"
            className="flex items-center justify-center p-1.5 rounded hover:bg-muted/70 relative cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span
              className="absolute bottom-1 left-1.5 right-1.5 h-0.5"
              style={{ backgroundColor: activeStyle.bgColor || '#ffffff' }}
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="p-2 w-44 z-[9999]">
          <div className="text-[11px] font-semibold text-muted-foreground mb-1">Fill Color</div>
          <div className="grid grid-cols-5 gap-1">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onApplyStyle({ bgColor: c })}
                className="w-6 h-6 rounded border border-border/80 hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="h-4 w-px bg-border/80 mx-1" />

      {/* Alignments */}
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

      <div className="h-4 w-px bg-border/80 mx-1" />

      {/* Insert / Delete Structure */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 bg-muted/40 hover:bg-muted/70 rounded border border-border/60 text-xs font-medium cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-primary" />
            <span>Insert</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-36 text-xs z-[9999]">
          <DropdownMenuItem onClick={onInsertRow}>Insert Row</DropdownMenuItem>
          <DropdownMenuItem onClick={onInsertCol}>Insert Column</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 bg-muted/40 hover:bg-muted/70 rounded border border-border/60 text-xs font-medium cursor-pointer transition-colors text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-36 text-xs z-[9999]">
          <DropdownMenuItem onClick={onDeleteRow}>Delete Row</DropdownMenuItem>
          <DropdownMenuItem onClick={onDeleteCol}>Delete Column</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onClear(false)}>Clear Contents</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onClear(true)}>Clear All (with Styles)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
