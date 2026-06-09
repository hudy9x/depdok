import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { indexMarkdownDocumentSections } from '@/api-client/knowledge-base';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { readFileContent } from '@/lib/fileOperations';
import { isKnowledgeGraphFile } from '@/lib/knowledgeGraph';

import { listDirectory } from './api';

interface MarkdownKnowledgeBaseDialogProps {
  workspaceRoot: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MarkdownFileOption {
  path: string;
  relativePath: string;
  title: string;
}

async function collectMarkdownFiles(rootPath: string): Promise<MarkdownFileOption[]> {
  const results: MarkdownFileOption[] = [];

  const walk = async (dirPath: string): Promise<void> => {
    const entries = await listDirectory(dirPath);

    for (const entry of entries) {
      if (entry.is_dir) {
        await walk(entry.path);
        continue;
      }

      const lowerName = entry.name.toLowerCase();
      if (!lowerName.endsWith('.md') || isKnowledgeGraphFile(entry.path)) {
        continue;
      }

      const relativePath = entry.path.startsWith(rootPath)
        ? entry.path.slice(rootPath.length).replace(/^[/\\]+/, '')
        : entry.path;

      results.push({
        path: entry.path,
        relativePath,
        title: entry.name,
      });
    }
  };

  await walk(rootPath);
  return results.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export function MarkdownKnowledgeBaseDialog({
  workspaceRoot,
  open,
  onOpenChange,
}: MarkdownKnowledgeBaseDialogProps) {
  const [files, setFiles] = useState<MarkdownFileOption[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedCount = selectedPaths.size;
  const allSelected = files.length > 0 && selectedCount === files.length;
  const hasFiles = files.length > 0;

  const selectedFiles = useMemo(
    () => files.filter((file) => selectedPaths.has(file.path)),
    [files, selectedPaths]
  );

  const loadFiles = async () => {
    setIsLoading(true);

    try {
      const markdownFiles = await collectMarkdownFiles(workspaceRoot);
      setFiles(markdownFiles);
      setSelectedPaths(new Set(markdownFiles.map((file) => file.path)));
    } catch (error) {
      console.error('Failed to scan markdown files:', error);
      toast.error('Failed to scan markdown files');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadFiles();
  }, [open, workspaceRoot]);

  const handleToggleFile = (path: string, checked: boolean) => {
    setSelectedPaths((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(path);
      } else {
        next.delete(path);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedPaths(new Set(files.map((file) => file.path)));
  };

  const handleClearSelection = () => {
    setSelectedPaths(new Set());
  };

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Select at least one markdown file');
      return;
    }

    setIsSubmitting(true);

    try {
      let indexedDocumentCount = 0;

      for (const file of selectedFiles) {
        const content = await readFileContent(file.path);
        const indexedSections = await indexMarkdownDocumentSections(
          file.path,
          file.title,
          content,
          [workspaceRoot]
        );
        indexedDocumentCount += indexedSections;
      }

      toast.success(`Indexed ${indexedDocumentCount} section${indexedDocumentCount === 1 ? '' : 's'} from ${selectedFiles.length} markdown file${selectedFiles.length === 1 ? '' : 's'}`);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to index markdown files:', error);
      toast.error('Failed to index selected markdown files');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Scan Markdown Files</DialogTitle>
          <DialogDescription>
            Choose which markdown files in this project should be inserted into the knowledge base.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {isLoading ? 'Scanning workspace…' : `${selectedCount} of ${files.length} files selected`}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleSelectAll} disabled={!hasFiles || allSelected || isLoading || isSubmitting}>
              Select all
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={handleClearSelection} disabled={selectedCount === 0 || isLoading || isSubmitting}>
              Clear
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => void loadFiles()} disabled={isLoading || isSubmitting} title="Rescan markdown files">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="border border-border rounded-md min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-[420px]">
            <div className="divide-y divide-border">
              {!isLoading && files.length === 0 && (
                <div className="px-4 py-8 text-sm text-center text-muted-foreground">
                  No markdown files found in this workspace.
                </div>
              )}

              {files.map((file) => {
                const checked = selectedPaths.has(file.path);

                return (
                  <label
                    key={file.path}
                    className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-accent/40 transition-colors"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => handleToggleFile(file.path, value === true)}
                      disabled={isSubmitting}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground truncate">{file.title}</div>
                      <div className="text-xs text-muted-foreground break-all">{file.relativePath}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={isLoading || isSubmitting || selectedCount === 0}>
            {isSubmitting ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Indexing…
              </>
            ) : (
              'Index selected files'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}