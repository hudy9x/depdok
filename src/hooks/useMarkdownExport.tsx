import { useState } from 'react';
import { toast } from 'sonner';
import { exportMarkdownToHtml, exportMarkdownToPdf, revealFile, readFileContent } from '@/lib/fileOperations';
import { stripFrontmatter } from '@/features/PreviewMarkdown/utils/frontmatter';

/**
 * Strips metadata (frontmatter) and trims whitespace from markdown before export.
 */
export function cleanMarkdownForExport(content: string): string {
  if (!content) return '';
  return stripFrontmatter(content).trim();
}

export function useMarkdownExport() {
  const [exporting, setExporting] = useState(false);

  const exportDocument = async (format: 'pdf' | 'html', filePath?: string, markdownContent?: string) => {
    setExporting(true);
    const toastId = toast.loading(`Exporting document to ${format.toUpperCase()}...`);
    
    try {
      let markdown = markdownContent;
      if (markdown === undefined && filePath) {
        markdown = await readFileContent(filePath);
      }
      
      if (markdown === undefined) {
        throw new Error('No markdown content to export');
      }

      // Filter out YAML frontmatter metadata section before exporting
      const cleanedMarkdown = cleanMarkdownForExport(markdown);

      let savedPath: string;
      if (format === 'pdf') {
        savedPath = await exportMarkdownToPdf(cleanedMarkdown, filePath);
      } else {
        savedPath = await exportMarkdownToHtml(cleanedMarkdown, filePath);
      }

      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Export Successful</span>
          <span className="text-xs text-muted-foreground truncate max-w-[250px]">
            Saved to: {savedPath}
          </span>
          <button
            onClick={() => {
              revealFile(savedPath).catch((err) => {
                console.error("[Export] revealFile failed:", err);
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
      console.error("[Export] export failed:", error);
      toast.error(`Export failed: ${error instanceof Error ? error.message : String(error)}`, {
        id: toastId,
        duration: 4000,
      });
    } finally {
      setExporting(false);
    }
  };

  return { exportDocument, exporting };
}
