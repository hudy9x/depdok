import { useState, useRef, useEffect, useCallback } from "react";
import { NodeViewWrapper, NodeViewContent, Editor } from "@tiptap/react";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { GripHorizontal, GripVertical, Plus, Trash2, ArrowUpFromLine, ArrowDownFromLine, MoveLeft, MoveRight, ArrowLeftFromLine, ArrowRightFromLine } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TableNodeViewProps {
  editor: Editor;
  node: ProseMirrorNode;
  getPos: () => number | undefined;
}

export function TableNodeView({ editor, node, getPos }: TableNodeViewProps) {
  const isEditable = editor.isEditable;
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [colWidths, setColWidths] = useState<number[]>([]);
  const [rowHeights, setRowHeights] = useState<number[]>([]);
  const [resizingCol, setResizingCol] = useState<number | null>(null);

  // Resize drag refs — kept outside React state to avoid re-renders during drag
  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(0);
  const resizeStartHandleLeftRef = useRef<number>(0);
  const resizeColIndexRef = useRef<number | null>(null);
  const resizeHandleRefs = useRef<(HTMLDivElement | null)[]>([]);

  const hideTimeoutRef = useRef<NodeJS.Timeout>();
  const tableRef = useRef<HTMLTableElement>(null);
  const isResizingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  const rows = node.childCount;
  let cols = 0;
  if (rows > 0) {
    // A table is a node with table_row children.
    // Each table_row has table_cell or table_header children.
    cols = node.child(0).childCount;
  }

  // Helper to set cursor inside a specific cell to make TipTap commands work
  const focusCell = (rowIndex: number, colIndex: number) => {
    const startPos = getPos();
    if (startPos === undefined) return;
    let currentPos = startPos + 1; // Pos of first row

    for (let r = 0; r <= rowIndex; r++) {
      const rowNode = node.child(r);
      if (r === rowIndex) {
        currentPos += 1; // Move inside the row
        for (let c = 0; c < colIndex; c++) {
          currentPos += rowNode.child(c).nodeSize;
        }
        break;
      } else {
        currentPos += rowNode.nodeSize;
      }
    }

    // Set selection inside the cell
    editor.commands.setTextSelection(currentPos + 1);
  };

  // ── Column resize ─────────────────────────────────────────────────────────

  /**
   * Get the <th> element at a given column index from the table's first row.
   * Returns null if the table or column is not found.
   */
  const getThElement = useCallback((colIndex: number): HTMLTableCellElement | null => {
    if (!tableRef.current) return null;
    const firstRow = tableRef.current.querySelector('tr');
    if (!firstRow) return null;
    const cells = Array.from(firstRow.querySelectorAll('th, td')) as HTMLTableCellElement[];
    return cells[colIndex] ?? null;
  }, []);

  /**
   * startColumnResize — mirrors startResize() from the reference HTML.
   * Captures the starting X position and the current <th> offsetWidth,
   * then attaches document-level move/up listeners for smooth drag tracking.
   */
  const startColumnResize = useCallback((e: React.MouseEvent, colIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    const th = getThElement(colIndex);
    if (!th) return;

    const handleEl = resizeHandleRefs.current[colIndex];

    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = th.offsetWidth;
    // Capture the handle's initial left so we can shift it during drag
    resizeStartHandleLeftRef.current = handleEl ? parseFloat(handleEl.style.left) || 0 : 0;
    resizeColIndexRef.current = colIndex;
    isResizingRef.current = true;
    setResizingCol(colIndex);

    // Prevent text selection and cursor flicker while dragging
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaX = moveEvent.clientX - resizeStartXRef.current;
      const newWidth = Math.max(50, resizeStartWidthRef.current + deltaX);
      // Clamp deltaX to the same minimum so the handle never overshoots
      const clampedDelta = newWidth - resizeStartWidthRef.current;

      // Live DOM update on the <th> — no React dispatch for 60fps smoothness
      const thEl = getThElement(resizeColIndexRef.current ?? colIndex);
      if (thEl) {
        thEl.style.width = `${newWidth}px`;
        thEl.style.minWidth = `${newWidth}px`;
      }

      // Move the handle divider to follow the column edge
      const activeHandle = resizeHandleRefs.current[resizeColIndexRef.current ?? colIndex];
      if (activeHandle) {
        activeHandle.style.left = `${resizeStartHandleLeftRef.current + clampedDelta}px`;
      }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      isResizingRef.current = false;
      setResizingCol(null);

      // Compute final width and persist into ProseMirror state
      const deltaX = upEvent.clientX - resizeStartXRef.current;
      const finalWidth = Math.max(50, resizeStartWidthRef.current + deltaX);

      // Focus the header cell so setCellAttribute targets the right node
      focusCell(0, resizeColIndexRef.current ?? colIndex);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor.chain() as any)
        .setCellAttribute('colwidth', finalWidth)
        .run();

      resizeColIndexRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [editor, getThElement, focusCell]);

  const handleAddBottom = () => {
    // Focus last row, any column
    focusCell(rows - 1, 0);
    (editor.chain().focus() as any).addRowAfter().run();
  };

  const handleAddRight = () => {
    // Focus any row, last column
    focusCell(0, cols - 1);
    (editor.chain().focus() as any).addColumnAfter().run();
  };

  const handleMoveColLeft = (colIndex: number) => {
    if (colIndex <= 0) return;

    const tablePos = getPos();
    if (tablePos === undefined) return;

    let tr = editor.state.tr;
    // Iterate through all rows from the bottom up (to prevent position shifting from affecting earlier replacements in the same row)
    for (let r = rows - 1; r >= 0; r--) {
      const rowNode = node.child(r);

      // Calculate position of the row
      let rowPos = tablePos + 1; // start inside table
      for (let i = 0; i < r; i++) {
        rowPos += node.child(i).nodeSize;
      }

      // Calculate positions of the two cells to swap
      let leftCellPos = rowPos + 1; // start inside row
      for (let i = 0; i < colIndex - 1; i++) {
        leftCellPos += rowNode.child(i).nodeSize;
      }
      const leftCell = rowNode.child(colIndex - 1);

      let rightCellPos = leftCellPos + leftCell.nodeSize;
      const rightCell = rowNode.child(colIndex);

      // Clone the nodes to insert them back
      const newLeft = rightCell.type.createAndFill(rightCell.attrs, rightCell.content) || rightCell;
      const newRight = leftCell.type.createAndFill(leftCell.attrs, leftCell.content) || leftCell;

      // Replace the right cell with the left's clone
      tr = tr.replaceWith(rightCellPos, rightCellPos + rightCell.nodeSize, newRight);
      // Replace the left cell with the right's clone
      tr = tr.replaceWith(leftCellPos, leftCellPos + leftCell.nodeSize, newLeft);
    }

    editor.view.dispatch(tr);
    focusCell(0, colIndex - 1); // Follow the column
  };

  const handleMoveColRight = (colIndex: number) => {
    if (colIndex >= cols - 1) return;
    handleMoveColLeft(colIndex + 1); // Moving right is just moving the next column left
    focusCell(0, colIndex + 1); // Follow the column
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isEditable) return;
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);

    const target = e.target as HTMLElement;

    // Check if hovering over handles themselves to preserve their active state
    if (target.closest('.table-handle')) {
      return;
    }

    // Check if hovering over a cell
    const cell = target.closest('td, th') as HTMLTableCellElement | null;
    if (cell) {
      // Find the robust position of this cell by scanning the NodeView's table wrapper
      const table = cell.closest('table');
      if (table) {
        // Measure and update geometries
        if (tableRef.current) {
          const firstRow = tableRef.current.querySelector('tr');
          if (firstRow) {
            const cells = Array.from(firstRow.children) as HTMLElement[];
            setColWidths(cells.map(c => c.offsetWidth));
          }
          const allRowsNode = Array.from(tableRef.current.querySelectorAll('tr'));
          setRowHeights(allRowsNode.map(r => r.offsetHeight));
        }

        // Collect all rows, skipping rows in nested tables if any
        const allRows = Array.from(table.querySelectorAll('tr'));
        const tr = cell.closest('tr') as HTMLTableRowElement | null;
        if (tr) {
          const rowIndex = allRows.indexOf(tr);

          // Get cells in this specific row to find the column index
          const rowCells = Array.from(tr.querySelectorAll('td, th'));
          const colIndex = rowCells.indexOf(cell);

          if (rowIndex !== -1 && colIndex !== -1) {
            setHoveredCol(colIndex);
            setHoveredRow(rowIndex);
            return;
          }
        }
      }
    }
  };

  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setHoveredCol(null);
      setHoveredRow(null);
    }, 150);
  };

  return (
    <NodeViewWrapper
      className="relative w-fit max-w-full my-6 group/table"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Top handles for columns */}
      {isEditable && (
        <div className="absolute -top-3 left-0 h-3 flex pointer-events-none z-10" style={{ width: tableRef.current?.offsetWidth || '100%' }}>
          {Array.from({ length: cols }).map((_, colIndex) => (
            <div
              key={`col-${colIndex}`}
              style={{ width: colWidths[colIndex] ? `${colWidths[colIndex]}px` : `${100 / cols}%` }}
              className={`flex-none flex justify-center items-end pb-1 transition-opacity duration-200 ${hoveredCol === colIndex ? 'opacity-100 pointer-events-auto' : 'opacity-0'}`}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className={`table-handle h-2 w-8 bg-muted rounded-full cursor-pointer hover:bg-primary/50 flex items-center justify-center`}>
                    <GripHorizontal className={`w-3 h-3 text-muted-foreground ${hoveredCol === colIndex ? 'block' : 'hidden'} hover:block`} />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => { focusCell(0, colIndex); (editor.chain().focus() as any).addColumnBefore().run(); }}>
                    <ArrowLeftFromLine className="w-4 h-4 mr-2" /> Insert Left
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { focusCell(0, colIndex); (editor.chain().focus() as any).addColumnAfter().run(); }}>
                    <ArrowRightFromLine className="w-4 h-4 mr-2" /> Insert Right
                  </DropdownMenuItem>
                  <div className="h-px bg-border my-1" />
                  {colIndex > 0 && (
                    <DropdownMenuItem onClick={() => handleMoveColLeft(colIndex)}>
                      <MoveLeft className="w-4 h-4 mr-2" /> Move Left
                    </DropdownMenuItem>
                  )}
                  {colIndex < cols - 1 && (
                    <DropdownMenuItem onClick={() => handleMoveColRight(colIndex)}>
                      <MoveRight className="w-4 h-4 mr-2" /> Move Right
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => { focusCell(0, colIndex); (editor.chain().focus() as any).deleteColumn().run(); }} className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Column
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {/* Column resize handles — thin dividers at each <th> right edge */}
      {isEditable && (
        <div
          className="absolute top-0 left-0 h-full pointer-events-none z-20"
          style={{ width: tableRef.current?.offsetWidth || '100%' }}
        >
          {Array.from({ length: cols }).map((_, colIndex) => {
            // Compute cumulative left offset up to (and including) this column
            const leftOffset = colWidths.slice(0, colIndex + 1).reduce((sum, w) => sum + w, 0);
            // Only show if we have measured widths yet
            if (!colWidths[colIndex]) return null;
            return (
              <div
                key={`resize-${colIndex}`}
                ref={(el) => { resizeHandleRefs.current[colIndex] = el; }}
                title="Drag to resize column"
                className={`table-handle absolute top-0 bottom-0 w-1 -translate-x-px pointer-events-auto cursor-col-resize transition-colors duration-150 ${
                  resizingCol === colIndex
                    ? 'bg-primary'
                    : 'bg-transparent hover:bg-primary/60'
                }`}
                style={{ left: `${leftOffset}px` }}
                onMouseDown={(e) => startColumnResize(e, colIndex)}
              />
            );
          })}
        </div>
      )}

      {/* Left handles for rows */}
      {isEditable && (
        <div className="absolute top-0 -left-3 w-3 flex flex-col pointer-events-none z-10" style={{ height: tableRef.current?.offsetHeight || '100%' }}>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div
              key={`row-${rowIndex}`}
              style={{ height: rowHeights[rowIndex] ? `${rowHeights[rowIndex]}px` : `${100 / rows}%` }}
              className={`flex-none flex items-center justify-end pr-1 transition-opacity duration-200 ${hoveredRow === rowIndex ? 'opacity-100 pointer-events-auto' : 'opacity-0'}`}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className={`table-handle w-2 h-8 bg-muted rounded-full cursor-pointer hover:bg-primary/50 flex items-center justify-center`}>
                    <GripVertical className={`w-3 h-3 text-muted-foreground ${hoveredRow === rowIndex ? 'block' : 'hidden'} hover:block`} />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => { focusCell(rowIndex, 0); (editor.chain().focus() as any).addRowBefore().run(); }}>
                    <ArrowUpFromLine className="w-4 h-4 mr-2" /> Insert Above
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { focusCell(rowIndex, 0); (editor.chain().focus() as any).addRowAfter().run(); }}>
                    <ArrowDownFromLine className="w-4 h-4 mr-2" /> Insert Below
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { focusCell(rowIndex, 0); (editor.chain().focus() as any).deleteRow().run(); }} className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Row
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {/* The actual table content */}
      <div className="overflow-x-auto w-full rounded-sm">
        <table ref={tableRef} className="w-full m-0 border-collapse top-0 left-0 relative">
          <NodeViewContent as={"tbody" as any} />
        </table>
      </div>

      {/* Right Add Column Handle */}
      {isEditable && (
        <div
          className="absolute top-0 -right-4 bottom-0 w-3 bg-muted/50 rounded-r hover:bg-primary/20 cursor-pointer flex items-center justify-center opacity-0 group-hover/table:opacity-100 transition-opacity"
          onClick={handleAddRight}
          title="Add Column"
        >
          <Plus className="w-3 h-3 text-muted-foreground" />
        </div>
      )}

      {/* Bottom Add Row Handle */}
      {isEditable && (
        <div
          className="absolute -bottom-4 left-0 right-0 h-3 bg-muted/50 rounded-b hover:bg-primary/20 cursor-pointer flex items-center justify-center opacity-0 group-hover/table:opacity-100 transition-opacity"
          onClick={handleAddBottom}
          title="Add Row"
        >
          <Plus className="w-3 h-3 text-muted-foreground" />
        </div>
      )}

      {/* Top Right Delete Table Handle */}
      {isEditable && (
        <div
          className="absolute -top-3 -right-3 w-6 h-6 bg-destructive/10 text-destructive rounded-md hover:bg-destructive hover:text-destructive-foreground cursor-pointer flex items-center justify-center opacity-0 group-hover/table:opacity-100 transition-opacity z-20"
          onClick={() => (editor.chain().focus() as any).deleteTable().run()}
          title="Delete Table"
        >
          <Trash2 className="w-3 h-3" />
        </div>
      )}
    </NodeViewWrapper>
  );
}
