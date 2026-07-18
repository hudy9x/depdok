import { useState, useRef, useEffect, useCallback } from "react";
import { NodeViewWrapper, NodeViewContent, Editor } from "@tiptap/react";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";

import { TableColumnHandles } from "./table/TableColumnHandles";
import { TableColumnResizeHandles } from "./table/TableColumnResizeHandles";
import { TableRowHandles } from "./table/TableRowHandles";
import { TableQuickActionHandles } from "./table/TableQuickActionHandles";

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
  const focusCell = useCallback((rowIndex: number, colIndex: number) => {
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
  }, [editor, getPos, node]);

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
   * startColumnResize — Mirrors startResize() from reference table implementation.
   * Captures starting X position and current <th> offsetWidth,
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

  const handleAddBottom = useCallback(() => {
    // Focus last row, any column
    focusCell(rows - 1, 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor.chain().focus() as any).addRowAfter().run();
  }, [editor, focusCell, rows]);

  const handleAddRight = useCallback(() => {
    // Focus any row, last column
    focusCell(0, cols - 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor.chain().focus() as any).addColumnAfter().run();
  }, [cols, editor, focusCell]);

  const handleMoveColLeft = useCallback((colIndex: number) => {
    if (colIndex <= 0) return;

    const tablePos = getPos();
    if (tablePos === undefined) return;

    let tr = editor.state.tr;
    // Iterate through all rows from the bottom up
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
  }, [editor, focusCell, getPos, node, rows]);

  const handleMoveColRight = useCallback((colIndex: number) => {
    if (colIndex >= cols - 1) return;
    handleMoveColLeft(colIndex + 1); // Moving right is just moving the next column left
    focusCell(0, colIndex + 1); // Follow the column
  }, [cols, focusCell, handleMoveColLeft]);

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

  const tableWidth = tableRef.current?.offsetWidth || '100%';
  const tableHeight = tableRef.current?.offsetHeight || '100%';

  return (
    <NodeViewWrapper
      className="relative w-fit max-w-full my-6 group/table"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Top handles for columns */}
      <TableColumnHandles
        isEditable={isEditable}
        cols={cols}
        colWidths={colWidths}
        hoveredCol={hoveredCol}
        tableWidth={tableWidth}
        editor={editor}
        focusCell={focusCell}
        onMoveColLeft={handleMoveColLeft}
        onMoveColRight={handleMoveColRight}
      />

      {/* Column resize handles */}
      <TableColumnResizeHandles
        isEditable={isEditable}
        cols={cols}
        colWidths={colWidths}
        resizingCol={resizingCol}
        tableWidth={tableWidth}
        resizeHandleRefs={resizeHandleRefs}
        onStartColumnResize={startColumnResize}
      />

      {/* Left handles for rows */}
      <TableRowHandles
        isEditable={isEditable}
        rows={rows}
        rowHeights={rowHeights}
        hoveredRow={hoveredRow}
        tableHeight={tableHeight}
        editor={editor}
        focusCell={focusCell}
      />

      {/* The actual table content */}
      <div className="overflow-x-auto w-full rounded-sm">
        <table ref={tableRef} className="w-full m-0 border-collapse top-0 left-0 relative">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <NodeViewContent as={"tbody" as any} />
        </table>
      </div>

      {/* Quick Action Handles: Add Column Right, Add Row Bottom, Delete Table */}
      <TableQuickActionHandles
        isEditable={isEditable}
        editor={editor}
        onAddColumnRight={handleAddRight}
        onAddRowBottom={handleAddBottom}
      />
    </NodeViewWrapper>
  );
}
