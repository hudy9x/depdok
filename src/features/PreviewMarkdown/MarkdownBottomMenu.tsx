import { useState } from "react";
import { Editor } from "@tiptap/react";
import { Download, FileCode, FileType, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { exportMarkdownToHtml, exportMarkdownToPdf, revealFile } from "@/lib/fileOperations";

import { BlockButtons } from "./MenuButtons";
import { MarkdownSizeControl, MarkdownSizeDropdown, type MarkdownEditorSize } from "./MarkdownSizeControl";

interface MarkdownBottomMenuProps {
  editor: Editor | null;
  editable?: boolean;
  size: MarkdownEditorSize;
  onSizeChange: (size: MarkdownEditorSize) => void;
  filePath?: string;
}

function ExportButton({ editor, filePath }: { editor: Editor; filePath?: string }) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: "pdf" | "html") => {
    console.log("[Export Frontend] handleExport triggered for format:", format);
    console.log("[Export Frontend] filePath is:", filePath);

    if (!editor) {
      console.warn("[Export Frontend] Editor is null, cannot proceed.");
      return;
    }
    setOpen(false);
    setExporting(true);

    const toastId = toast.loading(`Exporting document to ${format.toUpperCase()}...`);
    console.log("[Export Frontend] active toast loader shown, toastId:", toastId);

    try {
      const markdown = editor.getMarkdown();
      console.log("[Export Frontend] retrieved markdown from editor, length:", markdown.length);
      let savedPath: string;

      if (format === "pdf") {
        console.log("[Export Frontend] invoking exportMarkdownToPdf...");
        savedPath = await exportMarkdownToPdf(markdown, filePath);
      } else {
        console.log("[Export Frontend] invoking exportMarkdownToHtml...");
        savedPath = await exportMarkdownToHtml(markdown, filePath);
      }

      console.log("[Export Frontend] export successful, file saved at:", savedPath);

      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Export Successful</span>
          <span className="text-xs text-muted-foreground truncate max-w-[250px]">
            Saved to: {savedPath}
          </span>
          <button
            onClick={() => {
              console.log("[Export Frontend] 'Open Folder' clicked for path:", savedPath);
              revealFile(savedPath).catch((err) => {
                console.error("[Export Frontend] revealFile failed:", err);
              });
            }}
            className="text-xs text-primary font-medium text-left mt-1 hover:underline"
          >
            Open Folder
          </button>
        </div>,
        { id: toastId, duration: 6000 }
      );
    } catch (error) {
      console.error("[Export Frontend] export failed:", error);
      toast.error(`Export failed: ${error instanceof Error ? error.message : String(error)}`, {
        id: toastId,
        duration: 4000,
      });
    } finally {
      console.log("[Export Frontend] export operation finished, setting exporting=false");
      setExporting(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={exporting}
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

export function MarkdownBottomMenu({
  editor,
  editable = false,
  size,
  onSizeChange,
  filePath,
}: MarkdownBottomMenuProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full border border-border bg-background/85 backdrop-blur-md px-2.5 py-1 shadow-lg max-w-[95vw] select-none overflow-x-auto">
      {editable && editor && (
        <>
          <div className="flex items-center gap-0.5">
            <BlockButtons editor={editor} />
          </div>
          <div className="w-[1px] h-5 bg-border mx-1 shrink-0 editor-tools-divider" />
        </>
      )}
      <div className="size-control-expanded items-center gap-0.5 shrink-0">
        <MarkdownSizeControl
          size={size}
          onSizeChange={onSizeChange}
          className="flex items-center gap-0.5 shrink-0"
        />
      </div>
      <div className="size-control-dropdown items-center shrink-0">
        <MarkdownSizeDropdown
          size={size}
          onSizeChange={onSizeChange}
        />
      </div>
      {editor && (
        <div className="export-button-group items-center shrink-0">
          <div className="w-[1px] h-5 bg-border mx-1 shrink-0" />
          <ExportButton editor={editor} filePath={filePath} />
        </div>
      )}
    </div>
  );
}
