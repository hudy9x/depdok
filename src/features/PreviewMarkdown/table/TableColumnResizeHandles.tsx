import React from "react";

interface TableColumnResizeHandlesProps {
  isEditable: boolean;
  cols: number;
  colWidths: number[];
  resizingCol: number | null;
  tableWidth: number | string;
  resizeHandleRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  onStartColumnResize: (e: React.MouseEvent, colIndex: number) => void;
}

export function TableColumnResizeHandles({
  isEditable,
  cols,
  colWidths,
  resizingCol,
  tableWidth,
  resizeHandleRefs,
  onStartColumnResize,
}: TableColumnResizeHandlesProps): React.ReactElement | null {
  if (!isEditable) return null;

  return (
    <div
      className="absolute top-0 left-0 h-full pointer-events-none z-20"
      style={{ width: tableWidth }}
    >
      {Array.from({ length: cols }).map((_, colIndex) => {
        // Compute cumulative left offset up to (and including) this column
        const leftOffset = colWidths
          .slice(0, colIndex + 1)
          .reduce((sum, w) => sum + w, 0);

        // Only show if we have measured widths yet
        if (!colWidths[colIndex]) return null;

        return (
          <div
            key={`resize-${colIndex}`}
            ref={(el) => {
              resizeHandleRefs.current[colIndex] = el;
            }}
            title="Drag to resize column"
            className={`table-handle absolute top-0 bottom-0 w-1 -translate-x-px pointer-events-auto cursor-col-resize transition-colors duration-150 ${
              resizingCol === colIndex
                ? "bg-primary"
                : "bg-transparent hover:bg-primary/60"
            }`}
            style={{ left: `${leftOffset}px` }}
            onMouseDown={(e) => onStartColumnResize(e, colIndex)}
          />
        );
      })}
    </div>
  );
}
