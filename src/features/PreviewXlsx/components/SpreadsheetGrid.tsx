import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { CellCoordinate, RangeSelection, SheetModel } from '../core/types';
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
  onClearSelection?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
}

const DEFAULT_COL_WIDTH = 96;
const DEFAULT_ROW_HEIGHT = 24;
const HEADER_COL_WIDTH = 46;
const HEADER_ROW_HEIGHT = 24;

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

  // Cumulative positions for fast coordinate calculation
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

  const normalizedSelection = useMemo(() => normalizeRange(selection), [selection]);

  // Active column & row sets for header highlight (Excel / Google Sheets style)
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
    const left = colPositions[normalizedSelection.start.c];
    const top = rowPositions[normalizedSelection.start.r];
    const right = colPositions[normalizedSelection.end.c + 1];
    const bottom = rowPositions[normalizedSelection.end.r + 1];

    return {
      left: `${left + HEADER_COL_WIDTH}px`,
      top: `${top + HEADER_ROW_HEIGHT}px`,
      width: `${right - left}px`,
      height: `${bottom - top}px`,
    };
  }, [colPositions, rowPositions, normalizedSelection]);

  // Active cell editor pixel bounds
  const activeEditorPosition = useMemo(() => {
    const left = colPositions[activeCell.c] + HEADER_COL_WIDTH;
    const top = rowPositions[activeCell.r] + HEADER_ROW_HEIGHT;
    const width = colWidths[activeCell.c] || DEFAULT_COL_WIDTH;
    const height = rowHeights[activeCell.r] || DEFAULT_ROW_HEIGHT;

    return { top, left, width, height };
  }, [colPositions, rowPositions, colWidths, rowHeights, activeCell]);

  // Mouse handlers for cell selection
  const handleCellMouseDown = (r: number, c: number, e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    containerRef.current?.focus({ preventScroll: true });

    if (e.shiftKey) {
      // Expand selection
      onSelectRange({ start: selection.start, end: { r, c } }, activeCell);
      return;
    }

    isDragging.current = true;
    dragStartCoord.current = { r, c };
    onSelectRange({ start: { r, c }, end: { r, c } }, { r, c });
  };

  const handleCellMouseEnter = (r: number, c: number) => {
    if (!isDragging.current || !dragStartCoord.current) return;
    onSelectRange({ start: dragStartCoord.current, end: { r, c } }, dragStartCoord.current);
  };

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    dragStartCoord.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

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

  // Maintain focus on the spreadsheet grid whenever activeCell changes or editing finishes
  useEffect(() => {
    if (!isEditing) {
      containerRef.current?.focus({ preventScroll: true });
    }
  }, [isEditing, activeCell]);

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

          {/* Column Headers */}
          {colWidths.map((width, c) => (
            <div
              key={`col-${c}`}
              onClick={() => handleColHeaderClick(c)}
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
          ))}
        </div>

        {/* Grid Body with Sticky Row Headers */}
        <div className="relative">
          {rowHeights.map((height, r) => (
            <div key={`row-${r}`} className="flex" style={{ height: `${height}px` }}>
              {/* Sticky Row Header */}
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

              {/* Row Cells */}
              {colWidths.map((width, c) => {
                const addr = coordinateToAddress({ r, c });
                const cell = sheet.cells[addr];
                const displayVal = cell?.w !== undefined ? cell.w : cell?.calculatedValue !== undefined ? String(cell.calculatedValue) : cell?.v !== null && cell?.v !== undefined ? String(cell.v) : '';
                const style = cell?.s || {};

                return (
                  <div
                    key={addr}
                    onMouseDown={(e) => handleCellMouseDown(r, c, e)}
                    onMouseEnter={() => handleCellMouseEnter(r, c)}
                    onDoubleClick={() => onStartEdit()}
                    style={{
                      width: `${width}px`,
                      height: `${height}px`,
                      fontWeight: style.bold ? 'bold' : 'normal',
                      fontStyle: style.italic ? 'italic' : 'normal',
                      textDecoration: style.underline ? 'underline' : style.strike ? 'line-through' : 'none',
                      textAlign: style.align || 'left',
                      backgroundColor: style.bgColor || 'var(--cell-bg)',
                      color: style.color || 'inherit',
                      fontSize: style.fontSize ? `${style.fontSize}px` : '12px',
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
            onChange={onEditChange}
            onCommit={onCommitEdit}
            onCancel={onCancelEdit}
          />
        )}
      </div>
    </div>
  );
};
