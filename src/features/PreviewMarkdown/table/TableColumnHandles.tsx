import React from "react";
import { Editor } from "@tiptap/react";
import {
  ArrowLeftFromLine,
  ArrowRightFromLine,
  GripHorizontal,
  MoveLeft,
  MoveRight,
  Trash2,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TableColumnHandlesProps {
  isEditable: boolean;
  cols: number;
  colWidths: number[];
  hoveredCol: number | null;
  tableWidth: number | string;
  editor: Editor;
  focusCell: (rowIndex: number, colIndex: number) => void;
  onMoveColLeft: (colIndex: number) => void;
  onMoveColRight: (colIndex: number) => void;
}

export function TableColumnHandles({
  isEditable,
  cols,
  colWidths,
  hoveredCol,
  tableWidth,
  editor,
  focusCell,
  onMoveColLeft,
  onMoveColRight,
}: TableColumnHandlesProps): React.ReactElement | null {
  if (!isEditable) return null;

  return (
    <div
      className="absolute -top-3 left-0 h-3 flex pointer-events-none z-10"
      style={{ width: tableWidth }}
    >
      {Array.from({ length: cols }).map((_, colIndex) => (
        <div
          key={`col-${colIndex}`}
          style={{
            width: colWidths[colIndex]
              ? `${colWidths[colIndex]}px`
              : `${100 / cols}%`,
          }}
          className={`flex-none flex justify-center items-end pb-1 transition-opacity duration-200 ${
            hoveredCol === colIndex
              ? "opacity-100 pointer-events-auto"
              : "opacity-0"
          }`}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="table-handle h-2 w-8 bg-muted rounded-full cursor-pointer hover:bg-primary/50 flex items-center justify-center">
                <GripHorizontal
                  className={`w-3 h-3 text-muted-foreground ${
                    hoveredCol === colIndex ? "block" : "hidden"
                  } hover:block`}
                />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => {
                  focusCell(0, colIndex);
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (editor.chain().focus() as any).addColumnBefore().run();
                }}
              >
                <ArrowLeftFromLine className="w-4 h-4 mr-2" /> Insert Left
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  focusCell(0, colIndex);
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (editor.chain().focus() as any).addColumnAfter().run();
                }}
              >
                <ArrowRightFromLine className="w-4 h-4 mr-2" /> Insert Right
              </DropdownMenuItem>
              <div className="h-px bg-border my-1" />
              {colIndex > 0 && (
                <DropdownMenuItem onClick={() => onMoveColLeft(colIndex)}>
                  <MoveLeft className="w-4 h-4 mr-2" /> Move Left
                </DropdownMenuItem>
              )}
              {colIndex < cols - 1 && (
                <DropdownMenuItem onClick={() => onMoveColRight(colIndex)}>
                  <MoveRight className="w-4 h-4 mr-2" /> Move Right
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => {
                  focusCell(0, colIndex);
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (editor.chain().focus() as any).deleteColumn().run();
                }}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete Column
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
}
