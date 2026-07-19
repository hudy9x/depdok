import { useState } from "react";
import { Editor } from "@tiptap/react";
import { Paintbrush, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// 5-row color palette (9 colors per row)
const COLOR_PALETTE_ROWS: string[][] = [
  ["#7F1A10", "#E52F1E", "#EE942C", "#FFFF40", "#6EFA39", "#4F79DF", "#0000F6", "#8017F7", "#E52EF8"],
  ["#D9B1A7", "#EAC7C6", "#F7E2C9", "#FCF1C9", "#D1D3D2", "#C6D4F5", "#CDDDF0", "#D2CCE4", "#E2CCD7"],
  ["#C97864", "#D99290", "#EFC696", "#FAE296", "#B5D0A1", "#A0B9EF", "#9DBCE2", "#A89DCD", "#C69EB4"],
  ["#B3432A", "#C9635E", "#E8AC69", "#F7D669", "#93BB77", "#6D92E3", "#719CD3", "#8071B7", "#AE7394"],
  ["#8D2713", "#B12517", "#D48B3E", "#E6BD42", "#6E9C4D", "#436BCD", "#4778BA", "#584599", "#8F496D"],
];

interface TableCellColorPickerProps {
  editor: Editor;
  disabled?: boolean;
}

export function TableCellColorPicker({ editor, disabled }: TableCellColorPickerProps) {
  const [open, setOpen] = useState(false);

  const setCellBg = (color: string | null) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor.chain().focus() as any)
      .setCellAttribute("backgroundColor", color)
      .run();
    setOpen(false);
  };

  return (
    <Popover open={disabled ? false : open} onOpenChange={(nextOpen) => !disabled && setOpen(nextOpen)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Cell Background Color"
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="p-2 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-muted-foreground hover:text-foreground flex items-center justify-center"
        >
          <Paintbrush className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-2.5 flex flex-col gap-2 bg-popover/95 backdrop-blur-md border border-border shadow-xl rounded-lg"
        align="start"
        onCloseAutoFocus={(e: Event) => e.preventDefault()}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Cell Colors
          </p>
          <button
            type="button"
            title="Clear background"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={() => setCellBg(null)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors px-1 py-0.5 rounded hover:bg-accent"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        </div>

        {/* 9-column Color Grid across 3 rows */}
        <div className="flex flex-col gap-1">
          {COLOR_PALETTE_ROWS.map((row, rowIndex) => (
            <div key={`row-${rowIndex}`} className="grid grid-cols-9 gap-1">
              {row.map((color, colIndex) => (
                <button
                  key={`color-${rowIndex}-${colIndex}`}
                  type="button"
                  title={color}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={() => setCellBg(color)}
                  style={{ backgroundColor: color }}
                  className="w-5 h-5 rounded-sm border border-border/40 hover:scale-110 hover:z-10 transition-transform cursor-pointer"
                />
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

