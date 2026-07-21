import { useState } from "react";
import { Editor } from "@tiptap/react";
import { Download, FileCode, FileType, LoaderCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMarkdownExport } from "@/hooks/useMarkdownExport";

interface ExportButtonProps {
  editor: Editor | null;
  filePath?: string;
}

export function ExportButton({ editor, filePath }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const { exportDocument, exporting } = useMarkdownExport();

  const handleExport = async (format: "pdf" | "html") => {
    if (!editor) return;
    setOpen(false);
    const markdown = editor.getMarkdown();
    await exportDocument(format, filePath, markdown);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={exporting || !editor}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          className="p-2 rounded-full hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground flex items-center justify-center"
          title="Export Document"
          type="button"
        >
          {exporting ? (
            <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-1.5 flex flex-col gap-1 bg-popover/95 backdrop-blur-md border border-border shadow-lg"
        align="end"
        onCloseAutoFocus={(e: Event) => e.preventDefault()}
      >
        <button
          onClick={() => handleExport("pdf")}
          className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent flex items-start gap-2.5 transition-colors"
        >
          <FileType className="w-4 h-4 mt-0.5 text-red-500" />
          <div>
            <div className="font-medium text-foreground">Export as PDF</div>
            <div className="text-[10px] text-muted-foreground">Standard A4 styled layout</div>
          </div>
        </button>
        <button
          onClick={() => handleExport("html")}
          className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent flex items-start gap-2.5 transition-colors"
        >
          <FileCode className="w-4 h-4 mt-0.5 text-blue-500" />
          <div>
            <div className="font-medium text-foreground">Export as HTML</div>
            <div className="text-[10px] text-muted-foreground">Clean, styled HTML document</div>
          </div>
        </button>
      </PopoverContent>
    </Popover>
  );
}
