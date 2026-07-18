import React from "react";
import { Editor } from "@tiptap/react";
import {
  ArrowDownFromLine,
  ArrowUpFromLine,
  GripVertical,
  Trash2,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TableRowHandlesProps {
  isEditable: boolean;
  rows: number;
  rowHeights: number[];
  hoveredRow: number | null;
  tableHeight: number | string;
  editor: Editor;
  focusCell: (rowIndex: number, colIndex: number) => void;
}

export function TableRowHandles({
  isEditable,
  rows,
  rowHeights,
  hoveredRow,
  tableHeight,
  editor,
  focusCell,
}: TableRowHandlesProps): React.ReactElement | null {
  if (!isEditable) return null;

  return (
    <div
      className="absolute top-0 -left-3 w-3 flex flex-col pointer-events-none z-10"
      style={{ height: tableHeight }}
    >
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          style={{
            height: rowHeights[rowIndex]
              ? `${rowHeights[rowIndex]}px`
              : `${100 / rows}%`,
          }}
          className={`flex-none flex items-center justify-end pr-1 transition-opacity duration-200 ${
            hoveredRow === rowIndex
              ? "opacity-100 pointer-events-auto"
              : "opacity-0"
          }`}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="table-handle w-2 h-8 bg-muted rounded-full cursor-pointer hover:bg-primary/50 flex items-center justify-center">
                <GripVertical
                  className={`w-3 h-3 text-muted-foreground ${
                    hoveredRow === rowIndex ? "block" : "hidden"
                  } hover:block`}
                />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => {
                  focusCell(rowIndex, 0);
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (editor.chain().focus() as any).addRowBefore().run();
                }}
              >
                <ArrowUpFromLine className="w-4 h-4 mr-2" /> Insert Above
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  focusCell(rowIndex, 0);
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (editor.chain().focus() as any).addRowAfter().run();
                }}
              >
                <ArrowDownFromLine className="w-4 h-4 mr-2" /> Insert Below
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  focusCell(rowIndex, 0);
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (editor.chain().focus() as any).deleteRow().run();
                }}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete Row
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
}
