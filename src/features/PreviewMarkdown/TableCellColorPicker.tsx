import { useState } from "react";
import { Editor } from "@tiptap/react";
import { Paintbrush, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Fixed 5-color palette mapping colors to CSS classes
const COLOR_PALETTE = [
  { className: "bg-table-gray", label: "Gray" },
  { className: "bg-table-red", label: "Red" },
  { className: "bg-table-green", label: "Green" },
  { className: "bg-table-yellow", label: "Yellow" },
  { className: "bg-table-blue", label: "Blue" },
];

interface TableCellColorPickerProps {
  editor: Editor;
}

export function TableCellColorPicker({ editor }: TableCellColorPickerProps) {
  const [open, setOpen] = useState(false);

  // Return null if selection is not in a table cell or table header
  // const inCell = editor.isActive("tableCell") || editor.isActive("tableHeader");
  // if (!inCell) return null;

  const setCellBg = (className: string | null) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor.chain().focus() as any)
      .setCellAttribute("backgroundColor", className)
      .run();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Cell Background Color"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        >
          <Paintbrush className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-2 flex flex-col gap-1.5 bg-popover/95 backdrop-blur-md border border-border shadow-lg"
        align="start"
        onCloseAutoFocus={(e: Event) => e.preventDefault()}
      >
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-1">
          Cell Background
        </p>
        <div className="flex items-center gap-1.5">
          {COLOR_PALETTE.map(({ className, label }) => (
            <button
              key={className}
              type="button"
              title={label}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={() => setCellBg(className)}
              className={`w-6 h-6 rounded border border-border hover:scale-110 transition-transform shadow-sm ${className}`}
            />
          ))}
          <div className="w-px h-5 bg-border mx-0.5" />
          <button
            type="button"
            title="Clear background"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={() => setCellBg(null)}
            className="w-6 h-6 rounded border border-border hover:bg-accent transition-colors flex items-center justify-center"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
