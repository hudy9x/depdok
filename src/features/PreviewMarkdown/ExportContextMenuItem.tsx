import { Download, FileCode, FileType, LoaderCircle } from "lucide-react";
import {
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuItem,
} from "@/components/ui/context-menu";
import { useMarkdownExport } from "@/hooks/useMarkdownExport";

interface ExportContextMenuItemProps {
  filePath: string;
}

export function ExportContextMenuItem({ filePath }: ExportContextMenuItemProps) {
  const { exportDocument, exporting } = useMarkdownExport();

  if (!filePath.toLowerCase().endsWith('.md')) {
    return null;
  }

  const handleExport = async (format: "pdf" | "html") => {
    await exportDocument(format, filePath);
  };

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger disabled={exporting}>
        {exporting ? (
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        Export Document
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="w-48">
        <ContextMenuItem onClick={() => handleExport("pdf")}>
          <FileType className="mr-2 h-4 w-4 text-red-500" />
          Export as PDF
        </ContextMenuItem>
        <ContextMenuItem onClick={() => handleExport("html")}>
          <FileCode className="mr-2 h-4 w-4 text-blue-500" />
          Export as HTML
        </ContextMenuItem>
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}
