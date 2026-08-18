import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Scissors,
  Copy,
  Clipboard,
  ClipboardCheck,
  Plus,
  Trash2,
  X,
  EyeOff,
  Link as LinkIcon,
  Calendar,
  Clock,
  Type,
  Hash,
  DollarSign,
  Percent,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { CellCoordinate, CellStyle, RangeSelection, SheetModel } from '../core/types';
import {
  coordinateToAddress,
  indexToColumn,
  normalizeRange,
} from '../core/numberFormatter';
import { CellEditor } from './CellEditor';
import { cn } from '@/lib/utils';

interface SpreadsheetGridProps {
  sheet: SheetModel;
  selection: RangeSelection;
  activeCell: CellCoordinate;
  isEditing: boolean;
  editValue: string;
  onSelectRange: (range: RangeSelection, active?: CellCoordinate) => void;
  onStartEdit: (initialValue?: string) => void;
  onEditChange: (val: string) => void;
  onCommitEdit: (direction?: 'down' | 'up' | 'right' | 'left') => void;
  onCancelEdit: () => void;
  onResizeCol?: (colIndex: number, width: number) => void;
  onResizeRow?: (rowIndex: number, height: number) => void;
  onInsertCol?: (colIndex: number) => void;
  onDeleteCol?: (colIndex: number) => void;
  onInsertRow?: (rowIndex: number) => void;
  onDeleteRow?: (rowIndex: number) => void;
  onClearRange?: (rangeStr: string) => void;
  onPasteRange?: (startCoord: CellCoordinate, options?: { valuesOnly?: boolean }) => void;
  onApplyFormat?: (numFmt: string) => void;
  onApplyStyle?: (style: Partial<CellStyle>) => void;
  onClearSelection?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
}

const DEFAULT_COL_WIDTH = 96;
const DEFAULT_ROW_HEIGHT = 24;
const HEADER_COL_WIDTH = 46;
const HEADER_ROW_HEIGHT = 24;

const getBorderCss = (
  side?: boolean | { style?: string; color?: string },
  defaultColor?: string,
  defaultStyle = 'thin'
): string | undefined => {
  if (!side) return undefined;
  const styleType = (typeof side === 'object' ? side.style : undefined) || defaultStyle || 'thin';
  let color = (typeof side === 'object' ? side.color : undefined) || defaultColor;

  if (!color || color === '#000000' || color === '#000' || color.toLowerCase() === 'black') {
    color = 'var(--cell-border-solid, currentColor)';
  }

  let width = '1px';
  let lineStyle = 'solid';
  if (styleType === 'medium') {
    width = '2px';
  } else if (styleType === 'thick') {
    width = '3px';
  } else if (styleType === 'double') {
    width = '3px';
    lineStyle = 'double';
  } else if (styleType === 'dashed') {
    width = '1px';
    lineStyle = 'dashed';
  } else if (styleType === 'dotted') {
    width = '1px';
    lineStyle = 'dotted';
  }
  return `${width} ${lineStyle} ${color}`;
};

export const SpreadsheetGrid: React.FC<SpreadsheetGridProps> = ({
  sheet,
  selection,
  activeCell,
  isEditing,
  editValue,
  onSelectRange,
  onStartEdit,
  onEditChange,
  onCommitEdit,
  onCancelEdit,
  onResizeCol,
  onResizeRow,
  onInsertCol,
  onDeleteCol,
  onInsertRow,
  onDeleteRow,
  onClearRange,
  onPasteRange,
  onApplyFormat,
  onApplyStyle,
  onClearSelection,
  onCopy,
  onPaste,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartCoord = useRef<CellCoordinate | null>(null);

  // Column width and row height resolution
  const colWidths = useMemo(() => {
    const widths: number[] = [];
    for (let c = 0; c < sheet.colCount; c++) {
      widths[c] = sheet.columnWidths?.[c] || DEFAULT_COL_WIDTH;
    }
    return widths;
  }, [sheet.colCount, sheet.columnWidths]);

  const rowHeights = useMemo(() => {
    const heights: number[] = [];
    for (let r = 0; r < sheet.rowCount; r++) {
      heights[r] = sheet.rowHeights?.[r] || DEFAULT_ROW_HEIGHT;
    }
    return heights;
  }, [sheet.rowCount, sheet.rowHeights]);

  // Positions prefix sums
  const colPositions = useMemo(() => {
    const pos = [0];
    for (let i = 0; i < colWidths.length; i++) {
      pos.push(pos[i] + colWidths[i]);
    }
    return pos;
  }, [colWidths]);

  const rowPositions = useMemo(() => {
    const pos = [0];
    for (let i = 0; i < rowHeights.length; i++) {
      pos.push(pos[i] + rowHeights[i]);
    }
    return pos;
  }, [rowHeights]);

  // Active range normalized
  const normalizedSelection = useMemo(() => normalizeRange(selection), [selection]);

  // Active row/col indices for header highlight
  const activeCols = useMemo(() => {
    const set = new Set<number>();
    for (let c = normalizedSelection.start.c; c <= normalizedSelection.end.c; c++) {
      set.add(c);
    }
    return set;
  }, [normalizedSelection]);

  const activeRows = useMemo(() => {
    const set = new Set<number>();
    for (let r = normalizedSelection.start.r; r <= normalizedSelection.end.r; r++) {
      set.add(r);
    }
    return set;
  }, [normalizedSelection]);

  // Selection box pixel bounds
  const selectionBoxStyle = useMemo(() => {
    const minR = normalizedSelection.start.r;
    const maxR = normalizedSelection.end.r;
    const minC = normalizedSelection.start.c;
    const maxC = normalizedSelection.end.c;

    const left = colPositions[minC] + HEADER_COL_WIDTH;
    const top = rowPositions[minR] + HEADER_ROW_HEIGHT;
    const width = colPositions[maxC + 1] - colPositions[minC];
    const height = rowPositions[maxR + 1] - rowPositions[minR];

    return {
      transform: `translate3d(${left}px, ${top}px, 0px)`,
      width: `${width}px`,
      height: `${height}px`,
    };
  }, [normalizedSelection, colPositions, rowPositions]);

  // Active editor pixel position
  const activeEditorPosition = useMemo(() => {
    const left = colPositions[activeCell.c] + HEADER_COL_WIDTH;
    const top = rowPositions[activeCell.r] + HEADER_ROW_HEIGHT;
    const width = colWidths[activeCell.c] || DEFAULT_COL_WIDTH;
    const height = rowHeights[activeCell.r] || DEFAULT_ROW_HEIGHT;
    return { top, left, width, height };
  }, [activeCell, colPositions, rowPositions, colWidths, rowHeights]);

  // Mouse selection handling
  const handleCellMouseDown = (r: number, c: number, e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    containerRef.current?.focus({ preventScroll: true });

    if (e.shiftKey) {
      onSelectRange({ start: selection.start, end: { r, c } }, activeCell);
      return;
    }

    isDragging.current = true;
    dragStartCoord.current = { r, c };
    onSelectRange({ start: { r, c }, end: { r, c } }, { r, c });
  };

  const handleCellMouseEnter = (r: number, c: number) => {
    if (!isDragging.current || !dragStartCoord.current) return;
    onSelectRange({ start: dragStartCoord.current, end: { r, c } }, activeCell);
  };

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  // Column context menu actions
  const handleCopyColumn = async (colIndex: number) => {
    onSelectRange(
      { start: { r: 0, c: colIndex }, end: { r: sheet.rowCount - 1, c: colIndex } },
      { r: 0, c: colIndex }
    );
    let maxPopulatedRow = 0;
    for (let r = 0; r < sheet.rowCount; r++) {
      const addr = coordinateToAddress({ r, c: colIndex });
      if (sheet.cells[addr] && (sheet.cells[addr].v !== null || sheet.cells[addr].f)) {
        maxPopulatedRow = r;
      }
    }
    const rows: string[] = [];
    for (let r = 0; r <= maxPopulatedRow; r++) {
      const addr = coordinateToAddress({ r, c: colIndex });
      const cell = sheet.cells[addr];
      const val = cell?.f ? `=${cell.f}` : cell?.v !== null && cell?.v !== undefined ? String(cell.v) : '';
      rows.push(val);
    }
    await navigator.clipboard.writeText(rows.join('\n'));
  };

  const handleCutColumn = async (colIndex: number) => {
    await handleCopyColumn(colIndex);
    const colLetter = indexToColumn(colIndex);
    const rangeStr = `${colLetter}1:${colLetter}${sheet.rowCount}`;
    if (onClearRange) {
      onClearRange(rangeStr);
    }
  };

  const handlePasteColumn = (colIndex: number, options?: { valuesOnly?: boolean }) => {
    if (onPasteRange) {
      onPasteRange({ r: 0, c: colIndex }, options);
    }
  };

  const handleClearCol = (colIndex: number) => {
    const colLetter = indexToColumn(colIndex);
    const rangeStr = `${colLetter}1:${colLetter}${sheet.rowCount}`;
    if (onClearRange) {
      onClearRange(rangeStr);
    }
  };

  // Row context menu actions
  const handleCopyRow = async (rowIndex: number) => {
    onSelectRange(
      { start: { r: rowIndex, c: 0 }, end: { r: rowIndex, c: sheet.colCount - 1 } },
      { r: rowIndex, c: 0 }
    );
    let maxPopulatedCol = 0;
    for (let c = 0; c < sheet.colCount; c++) {
      const addr = coordinateToAddress({ r: rowIndex, c });
      if (sheet.cells[addr] && (sheet.cells[addr].v !== null || sheet.cells[addr].f)) {
        maxPopulatedCol = c;
      }
    }
    const cols: string[] = [];
    for (let c = 0; c <= maxPopulatedCol; c++) {
      const addr = coordinateToAddress({ r: rowIndex, c });
      const cell = sheet.cells[addr];
      const val = cell?.f ? `=${cell.f}` : cell?.v !== null && cell?.v !== undefined ? String(cell.v) : '';
      cols.push(val);
    }
    await navigator.clipboard.writeText(cols.join('\t'));
  };

  const handleCutRow = async (rowIndex: number) => {
    await handleCopyRow(rowIndex);
    const rangeStr = `A${rowIndex + 1}:${indexToColumn(sheet.colCount - 1)}${rowIndex + 1}`;
    if (onClearRange) {
      onClearRange(rangeStr);
    }
  };

  const handlePasteRow = (rowIndex: number, options?: { valuesOnly?: boolean }) => {
    if (onPasteRange) {
      onPasteRange({ r: rowIndex, c: 0 }, options);
    }
  };

  const handleClearRow = (rowIndex: number) => {
    const rangeStr = `A${rowIndex + 1}:${indexToColumn(sheet.colCount - 1)}${rowIndex + 1}`;
    if (onClearRange) {
      onClearRange(rangeStr);
    }
  };

  // Cell selection context menu actions
  const handleCellContextMenu = (r: number, c: number) => {
    const norm = normalizeRange(selection);
    const isInSelection =
      r >= norm.start.r && r <= norm.end.r && c >= norm.start.c && c <= norm.end.c;
    if (!isInSelection) {
      onSelectRange({ start: { r, c }, end: { r, c } }, { r, c });
    }
  };

  const handleCopySelectedCells = async () => {
    const norm = normalizeRange(selection);
    const rows: string[] = [];
    for (let r = norm.start.r; r <= norm.end.r; r++) {
      const rowVals: string[] = [];
      for (let c = norm.start.c; c <= norm.end.c; c++) {
        const addr = coordinateToAddress({ r, c });
        const cell = sheet.cells[addr];
        const val = cell?.f ? `=${cell.f}` : cell?.v !== null && cell?.v !== undefined ? String(cell.v) : '';
        rowVals.push(val);
      }
      rows.push(rowVals.join('\t'));
    }
    await navigator.clipboard.writeText(rows.join('\n'));
  };

  const handleCutSelectedCells = async () => {
    await handleCopySelectedCells();
    if (onClearSelection) {
      onClearSelection();
    }
  };

  const handlePasteSelectedCells = (options?: { valuesOnly?: boolean }) => {
    const norm = normalizeRange(selection);
    if (onPasteRange) {
      onPasteRange(norm.start, options);
    }
  };

  const handleApplyCellFormat = (formatKey: 'number' | 'text' | 'date' | 'datetime' | 'time' | 'link' | 'currency' | 'percent') => {
    if (formatKey === 'number') {
      onApplyFormat?.('0.00');
    } else if (formatKey === 'text') {
      onApplyFormat?.('@');
    } else if (formatKey === 'date') {
      onApplyFormat?.('YYYY-MM-DD');
    } else if (formatKey === 'datetime') {
      onApplyFormat?.('YYYY-MM-DD HH:mm:ss');
    } else if (formatKey === 'time') {
      onApplyFormat?.('HH:mm:ss');
    } else if (formatKey === 'currency') {
      onApplyFormat?.('$#,##0.00');
    } else if (formatKey === 'percent') {
      onApplyFormat?.('0.0%');
    } else if (formatKey === 'link') {
      onApplyStyle?.({ color: '#2563eb', underline: true });
    }
  };

  // Column Header click -> select entire column
  const handleColHeaderClick = (colIndex: number) => {
    onSelectRange(
      {
        start: { r: 0, c: colIndex },
        end: { r: sheet.rowCount - 1, c: colIndex },
      },
      { r: 0, c: colIndex }
    );
  };

  // Row Header click -> select entire row
  const handleRowHeaderClick = (rowIndex: number) => {
    onSelectRange(
      {
        start: { r: rowIndex, c: 0 },
        end: { r: rowIndex, c: sheet.colCount - 1 },
      },
      { r: rowIndex, c: 0 }
    );
  };

  // Select all corner button
  const handleSelectAll = () => {
    onSelectRange(
      {
        start: { r: 0, c: 0 },
        end: { r: sheet.rowCount - 1, c: sheet.colCount - 1 },
      },
      { r: 0, c: 0 }
    );
  };

  // Maintain focus on the spreadsheet grid only when editing state changes
  useEffect(() => {
    if (!isEditing) {
      containerRef.current?.focus({ preventScroll: true });
    }
  }, [isEditing]);

  // Smoothly auto-scroll the active cell into view
  useEffect(() => {
    if (!containerRef.current) return;
    const left = colPositions[activeCell.c] + HEADER_COL_WIDTH;
    const right = left + (colWidths[activeCell.c] || DEFAULT_COL_WIDTH);
    const top = rowPositions[activeCell.r] + HEADER_ROW_HEIGHT;
    const bottom = top + (rowHeights[activeCell.r] || DEFAULT_ROW_HEIGHT);

    const scrollLeft = containerRef.current.scrollLeft;
    const scrollTop = containerRef.current.scrollTop;
    const clientWidth = containerRef.current.clientWidth;
    const clientHeight = containerRef.current.clientHeight;

    if (left < scrollLeft + HEADER_COL_WIDTH) {
      containerRef.current.scrollLeft = left - HEADER_COL_WIDTH;
    } else if (right > scrollLeft + clientWidth) {
      containerRef.current.scrollLeft = right - clientWidth;
    }

    if (top < scrollTop + HEADER_ROW_HEIGHT) {
      containerRef.current.scrollTop = top - HEADER_ROW_HEIGHT;
    } else if (bottom > scrollTop + clientHeight) {
      containerRef.current.scrollTop = bottom - clientHeight;
    }
  }, [activeCell, colPositions, rowPositions, colWidths, rowHeights]);

  // Keyboard navigation on grid
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isEditing) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextR = Math.min(activeCell.r + 1, sheet.rowCount - 1);
      if (e.shiftKey) {
        onSelectRange({ start: selection.start, end: { r: nextR, c: selection.end.c } }, activeCell);
      } else {
        onSelectRange({ start: { r: nextR, c: activeCell.c }, end: { r: nextR, c: activeCell.c } }, { r: nextR, c: activeCell.c });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextR = Math.max(activeCell.r - 1, 0);
      if (e.shiftKey) {
        onSelectRange({ start: selection.start, end: { r: nextR, c: selection.end.c } }, activeCell);
      } else {
        onSelectRange({ start: { r: nextR, c: activeCell.c }, end: { r: nextR, c: activeCell.c } }, { r: nextR, c: activeCell.c });
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextC = Math.min(activeCell.c + 1, sheet.colCount - 1);
      if (e.shiftKey) {
        onSelectRange({ start: selection.start, end: { r: selection.end.r, c: nextC } }, activeCell);
      } else {
        onSelectRange({ start: { r: activeCell.r, c: nextC }, end: { r: activeCell.r, c: nextC } }, { r: activeCell.r, c: nextC });
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const nextC = Math.max(activeCell.c - 1, 0);
      if (e.shiftKey) {
        onSelectRange({ start: selection.start, end: { r: selection.end.r, c: nextC } }, activeCell);
      } else {
        onSelectRange({ start: { r: activeCell.r, c: nextC }, end: { r: activeCell.r, c: nextC } }, { r: activeCell.r, c: nextC });
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const nextC = e.shiftKey ? Math.max(activeCell.c - 1, 0) : Math.min(activeCell.c + 1, sheet.colCount - 1);
      onSelectRange({ start: { r: activeCell.r, c: nextC }, end: { r: activeCell.r, c: nextC } }, { r: activeCell.r, c: nextC });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const nextR = e.shiftKey ? Math.max(activeCell.r - 1, 0) : Math.min(activeCell.r + 1, sheet.rowCount - 1);
      onSelectRange({ start: { r: nextR, c: activeCell.c }, end: { r: nextR, c: activeCell.c } }, { r: nextR, c: activeCell.c });
    } else if (e.key === 'F2') {
      e.preventDefault();
      onStartEdit();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (onClearSelection) {
        e.preventDefault();
        onClearSelection();
      }
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
      if (onCopy) onCopy();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
      if (onPaste) onPaste();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Direct typing starts edit immediately on active cell
      e.preventDefault();
      onStartEdit(e.key);
    }
  };

  // Column Resizing Handler
  const startColResize = (colIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const initialWidth = colWidths[colIndex];

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(initialWidth + delta, 30);
      if (onResizeCol) onResizeCol(colIndex, newWidth);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Row Resizing Handler
  const startRowResize = (rowIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const startY = e.clientY;
    const initialHeight = rowHeights[rowIndex];

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientY - startY;
      const newHeight = Math.max(initialHeight + delta, 16);
      if (onResizeRow) onResizeRow(rowIndex, newHeight);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const activeCellAddr = coordinateToAddress(activeCell);
  const activeCellModel = sheet.cells[activeCellAddr];

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="relative flex-1 w-full h-full overflow-auto outline-none bg-background select-none depdok-spreadsheet depdok-spreadsheet-grid"
    >
      <div
        className="relative"
        style={{
          width: `${colPositions[colPositions.length - 1] + HEADER_COL_WIDTH}px`,
          height: `${rowPositions[rowPositions.length - 1] + HEADER_ROW_HEIGHT}px`,
        }}
      >
        {/* Top Header Row (Corner + Column Headers) */}
        <div
          className="sticky top-0 z-20 flex bg-background"
          style={{
            height: `${HEADER_ROW_HEIGHT}px`,
          }}
        >
          {/* Top-Left Select All Corner */}
          <div
            onClick={handleSelectAll}
            style={{ width: `${HEADER_COL_WIDTH}px`, height: `${HEADER_ROW_HEIGHT}px` }}
            className="sticky left-0 z-30 depdok-header-cell cursor-pointer hover:bg-muted/80 border-r border-b border-border/80 shrink-0"
            title="Select all"
          />

          {/* Column Headers with Context Menu */}
          {colWidths.map((width, c) => (
            <ContextMenu key={`col-${c}`}>
              <ContextMenuTrigger asChild>
                <div
                  onClick={() => handleColHeaderClick(c)}
                  onContextMenu={() => handleColHeaderClick(c)}
                  style={{ width: `${width}px`, height: `${HEADER_ROW_HEIGHT}px` }}
                  className={cn(
                    'depdok-header-cell cursor-pointer shrink-0 transition-colors',
                    activeCols.has(c) && 'active'
                  )}
                >
                  <span>{indexToColumn(c)}</span>
                  <div
                    onMouseDown={(e) => startColResize(c, e)}
                    className="depdok-resize-col-handle"
                  />
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-56 text-xs">
                <ContextMenuItem onClick={() => handleCutColumn(c)} className="gap-2">
                  <Scissors className="w-3.5 h-3.5" />
                  <span className="flex-1">Cut</span>
                  <ContextMenuShortcut>⌘X</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleCopyColumn(c)} className="gap-2">
                  <Copy className="w-3.5 h-3.5" />
                  <span className="flex-1">Copy</span>
                  <ContextMenuShortcut>⌘C</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handlePasteColumn(c)} className="gap-2">
                  <Clipboard className="w-3.5 h-3.5" />
                  <span className="flex-1">Paste</span>
                  <ContextMenuShortcut>⌘V</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuSub>
                  <ContextMenuSubTrigger className="gap-2">
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span>Paste special</span>
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-40 text-xs">
                    <ContextMenuItem onClick={() => handlePasteColumn(c, { valuesOnly: true })}>
                      <span>Values only</span>
                    </ContextMenuItem>
                  </ContextMenuSubContent>
                </ContextMenuSub>

                <ContextMenuSeparator />

                <ContextMenuItem onClick={() => onInsertCol?.(c)} className="gap-2">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Insert 1 column left</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onInsertCol?.(c + 1)} className="gap-2">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Insert 1 column right</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onDeleteCol?.(c)} className="gap-2 text-destructive focus:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete column</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleClearCol(c)} className="gap-2">
                  <X className="w-3.5 h-3.5" />
                  <span>Clear column</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onResizeCol?.(c, 0)} className="gap-2">
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Hide column</span>
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>

        {/* Grid Body with Sticky Row Headers and Single Cell Context Menu */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="relative">
              {rowHeights.map((height, r) => (
                <div key={`row-${r}`} className="flex" style={{ height: `${height}px` }}>
                  {/* Sticky Row Header with Context Menu */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        onClick={() => handleRowHeaderClick(r)}
                        style={{
                          width: `${HEADER_COL_WIDTH}px`,
                          height: `${height}px`,
                        }}
                        className={cn(
                          'sticky left-0 z-10 depdok-header-cell cursor-pointer shrink-0 transition-colors',
                          activeRows.has(r) && 'active'
                        )}
                      >
                        <span>{r + 1}</span>
                        <div
                          onMouseDown={(e) => startRowResize(r, e)}
                          className="depdok-resize-row-handle"
                        />
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 text-xs">
                      <ContextMenuItem onClick={() => handleCutRow(r)} className="gap-2">
                        <Scissors className="w-3.5 h-3.5" />
                        <span className="flex-1">Cut</span>
                        <ContextMenuShortcut>⌘X</ContextMenuShortcut>
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handleCopyRow(r)} className="gap-2">
                        <Copy className="w-3.5 h-3.5" />
                        <span className="flex-1">Copy</span>
                        <ContextMenuShortcut>⌘C</ContextMenuShortcut>
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handlePasteRow(r)} className="gap-2">
                        <Clipboard className="w-3.5 h-3.5" />
                        <span className="flex-1">Paste</span>
                        <ContextMenuShortcut>⌘V</ContextMenuShortcut>
                      </ContextMenuItem>
                      <ContextMenuSub>
                        <ContextMenuSubTrigger className="gap-2">
                          <ClipboardCheck className="w-3.5 h-3.5" />
                          <span>Paste special</span>
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent className="w-40 text-xs">
                          <ContextMenuItem onClick={() => handlePasteRow(r, { valuesOnly: true })}>
                            <span>Values only</span>
                          </ContextMenuItem>
                        </ContextMenuSubContent>
                      </ContextMenuSub>

                      <ContextMenuSeparator />

                      <ContextMenuItem onClick={() => onInsertRow?.(r)} className="gap-2">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Insert 1 row above</span>
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => onInsertRow?.(r + 1)} className="gap-2">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Insert 1 row below</span>
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => onDeleteRow?.(r)} className="gap-2 text-destructive focus:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete row</span>
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handleClearRow(r)} className="gap-2">
                        <X className="w-3.5 h-3.5" />
                        <span>Clear row</span>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                  {/* Row Cells */}
                  {colWidths.map((width, c) => {
                    const addr = coordinateToAddress({ r, c });
                    const cell = sheet.cells[addr];
                    const displayVal = cell?.w !== undefined ? cell.w : cell?.calculatedValue !== undefined ? String(cell.calculatedValue) : cell?.v !== null && cell?.v !== undefined ? String(cell.v) : '';
                    const style = cell?.s || {};
                    const border = style.border;
                    const borderTop = border?.top ? getBorderCss(border.top, border.color, border.style) : undefined;
                    const borderBottom = border?.bottom ? getBorderCss(border.bottom, border.color, border.style) : undefined;
                    const borderLeft = border?.left ? getBorderCss(border.left, border.color, border.style) : undefined;
                    const borderRight = border?.right ? getBorderCss(border.right, border.color, border.style) : undefined;
                    const hasCustomBorder = Boolean(borderTop || borderBottom || borderLeft || borderRight);
                    const hasBgColor = Boolean(style.bgColor && style.bgColor !== 'transparent');
                    const cellTextColor = style.color ? style.color : hasBgColor ? '#000000' : 'inherit';

                    return (
                      <div
                        key={addr}
                        onMouseDown={(e) => handleCellMouseDown(r, c, e)}
                        onMouseEnter={() => handleCellMouseEnter(r, c)}
                        onContextMenu={() => handleCellContextMenu(r, c)}
                        onDoubleClick={() => onStartEdit()}
                        style={{
                          width: `${width}px`,
                          height: `${height}px`,
                          fontWeight: style.bold ? 'bold' : 'normal',
                          fontStyle: style.italic ? 'italic' : 'normal',
                          textDecoration: style.underline ? 'underline' : style.strike ? 'line-through' : 'none',
                          textAlign: style.align || 'left',
                          backgroundColor: style.bgColor || 'var(--cell-bg)',
                          color: cellTextColor,
                          fontSize: style.fontSize ? `${style.fontSize}px` : '12px',
                          borderTop,
                          borderBottom,
                          borderLeft,
                          borderRight,
                          zIndex: hasCustomBorder ? 1 : undefined,
                        }}
                        className={cn(
                          'depdok-grid-cell flex items-center shrink-0 cursor-cell',
                          cell?.error && 'text-red-500 font-semibold'
                        )}
                      >
                        <span className="truncate w-full">{displayVal}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </ContextMenuTrigger>

          {/* Cell / Selection Context Menu Content */}
          <ContextMenuContent className="w-56 text-xs">
            <ContextMenuItem onClick={handleCutSelectedCells} className="gap-2">
              <Scissors className="w-3.5 h-3.5" />
              <span className="flex-1">Cut</span>
              <ContextMenuShortcut>⌘X</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={handleCopySelectedCells} className="gap-2">
              <Copy className="w-3.5 h-3.5" />
              <span className="flex-1">Copy</span>
              <ContextMenuShortcut>⌘C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handlePasteSelectedCells()} className="gap-2">
              <Clipboard className="w-3.5 h-3.5" />
              <span className="flex-1">Paste</span>
              <ContextMenuShortcut>⌘V</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSub>
              <ContextMenuSubTrigger className="gap-2">
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Paste special</span>
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-40 text-xs">
                <ContextMenuItem onClick={() => handlePasteSelectedCells({ valuesOnly: true })}>
                  <span>Values only</span>
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuSeparator />

            <ContextMenuSub>
              <ContextMenuSubTrigger className="gap-2">
                <Type className="w-3.5 h-3.5" />
                <span>Format cells</span>
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-52 text-xs">
                <ContextMenuItem onClick={() => handleApplyCellFormat('number')} className="gap-2">
                  <Hash className="w-3.5 h-3.5" />
                  <span>Number (0.00)</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleApplyCellFormat('text')} className="gap-2">
                  <Type className="w-3.5 h-3.5" />
                  <span>Text (Plain)</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleApplyCellFormat('date')} className="gap-2">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Date (YYYY-MM-DD)</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleApplyCellFormat('datetime')} className="gap-2">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Date Time (YYYY-MM-DD HH:mm:ss)</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleApplyCellFormat('time')} className="gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Time (HH:mm:ss)</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleApplyCellFormat('link')} className="gap-2">
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>Link (Hyperlink)</span>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => handleApplyCellFormat('currency')} className="gap-2">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Currency ($#,##0.00)</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleApplyCellFormat('percent')} className="gap-2">
                  <Percent className="w-3.5 h-3.5" />
                  <span>Percentage (0.0%)</span>
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuSeparator />

            <ContextMenuItem onClick={() => onClearSelection?.()} className="gap-2">
              <X className="w-3.5 h-3.5" />
              <span>Clear contents</span>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {/* Selection Rectangle Overlay */}
        <div
          className="depdok-selection-box"
          style={selectionBoxStyle}
        >
          {/* Fill Handle at Bottom-Right */}
          <div className="depdok-fill-handle" />
        </div>

        {/* Active Inline Cell Editor */}
        {isEditing && (
          <CellEditor
            initialValue={editValue}
            position={activeEditorPosition}
            style={activeCellModel?.s}
            numFmt={activeCellModel?.numFmt}
            onChange={onEditChange}
            onCommit={onCommitEdit}
            onCancel={onCancelEdit}
          />
        )}
      </div>
    </div>
  );
};
