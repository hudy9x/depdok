import { useState, useRef, useEffect } from "react";
import { NodeViewWrapper, NodeViewContent, Editor } from "@tiptap/react";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { GripHorizontal, GripVertical, Plus, Trash2, ArrowLeftFromLine, ArrowRightFromLine, ArrowUpFromLine, ArrowDownFromLine } from "lucide-react";
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

  const hideTimeoutRef = useRef<NodeJS.Timeout>();
  const tableRef = useRef<HTMLTableElement>(null);

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
                  <DropdownMenuItem onClick={() => { focusCell(0, colIndex); (editor.chain().focus() as any).deleteColumn().run(); }} className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Column
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
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
