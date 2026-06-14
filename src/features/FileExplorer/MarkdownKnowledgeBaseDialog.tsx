import { useEffect, useMemo, useState, useRef } from 'react';
import { LoaderCircle, RefreshCw, AlertTriangle, Database } from 'lucide-react';
import { toast } from 'sonner';

import {
  indexMarkdownDocumentSections,
  rebuildAllEdges,
  getCurrentEmbeddingModel,
  updateEmbeddingModelAndReindex,
  getModelDownloadSize
} from '@/api-client/knowledge-base';
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
import { SettingsDialog } from '@/features/SettingsDialog';

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
  const [isModelDownloaded, setIsModelDownloaded] = useState<boolean | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null);
  const intervalRef = useRef<any>(null);

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
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (open) {
      getCurrentEmbeddingModel()
        .then((status) => {
          setIsModelDownloaded(status.isDownloaded);
          if (status.isDownloaded) {
            void loadFiles();
          }
        })
        .catch((err) => {
          console.error('Failed to get current embedding model:', err);
          setIsModelDownloaded(false);
        });
    } else {
      setIsModelDownloaded(null);
      setIsDownloading(false);
      setDownloadPercent(null);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setFiles([]);
      setSelectedPaths(new Set());
    }
  }, [open, workspaceRoot]);

  const handleDownloadDefaultModel = async () => {
    if (!workspaceRoot) {
      toast.error('Please open a workspace first.');
      return;
    }
    setIsDownloading(true);
    setDownloadPercent(0);

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(async () => {
      try {
        const bytes = await getModelDownloadSize('all-MiniLM-L6-v2');
        const targetBytes = 22 * 1024 * 1024; // 22 MB
        let pct = Math.floor((bytes / targetBytes) * 100);
        if (pct > 99) pct = 99;
        if (pct < 0) pct = 0;
        setDownloadPercent(pct);
      } catch (err) {
        console.error(err);
      }
    }, 400);

    const promise = updateEmbeddingModelAndReindex(
      'local',
      'all-MiniLM-L6-v2',
      undefined,
      workspaceRoot
    );

    toast.promise(promise, {
      loading: 'Downloading model weights and indexing database (approx. 22 MB)...',
      success: (count) => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setIsDownloading(false);
        setDownloadPercent(null);
        setIsModelDownloaded(true);
        void loadFiles();
        return `Model downloaded and indexed ${count} sections successfully!`;
      },
      error: (err: unknown) => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setIsDownloading(false);
        setDownloadPercent(null);
        console.error('Failed to download model:', err);
        return `Download failed: ${String(err)}`;
      },
    });
  };

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

      // Rebuild edges so all markdown links are correctly created in the graph
      await rebuildAllEdges();

      toast.success(`Indexed ${indexedDocumentCount} section${indexedDocumentCount === 1 ? '' : 's'} from ${selectedFiles.length} markdown file${selectedFiles.length === 1 ? '' : 's'}`);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to index markdown files:', error);
      toast.error('Failed to index selected markdown files');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  if (isModelDownloaded === null) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md py-12 flex flex-col items-center justify-center">
          <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground mt-3">Checking embedding model status...</span>
        </DialogContent>
      </Dialog>
    );
  }

  if (isModelDownloaded === false) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Embedding Model Required
            </DialogTitle>
            <DialogDescription className="pt-2 leading-relaxed text-sm">
              Depdok needs an embedding model to index and scan your documents for the knowledge base.
              <br /><br />
              No embedding model has been downloaded yet. To enable knowledge base features, you must download a model.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            {isDownloading ? (
              <div className="flex flex-col items-center justify-center p-6 bg-secondary/20 border border-border/40 rounded-xl space-y-3 w-full">
                <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  Downloading Embedding Model...
                </span>
                {downloadPercent !== null && (
                  <div className="w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className="bg-primary text-[10px] font-semibold text-primary-foreground text-center p-0.5 leading-none rounded-full h-4 flex items-center justify-center transition-all duration-300 min-w-[2rem]"
                      style={{ width: `${downloadPercent}%` }}
                    >
                      {downloadPercent}%
                    </div>
                  </div>
                )}
                <span className="text-xs text-muted-foreground text-center">
                  Downloading weights for <code className="px-1.5 py-0.5 rounded bg-muted">all-MiniLM-L6-v2</code> (approx. 22 MB). This will only happen once.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <Button
                  type="button"
                  onClick={handleDownloadDefaultModel}
                  disabled={isDownloading}
                  className="w-full font-semibold"
                >
                  <Database className="mr-2 h-4 w-4" />
                  Download Default Model (22 MB)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSettings(true)}
                  disabled={isDownloading}
                  className="w-full"
                >
                  Configure Other Models
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isDownloading}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
        {showSettings && (
          <SettingsDialog
            open={showSettings}
            onOpenChange={(openVal) => {
              setShowSettings(openVal);
              if (!openVal) {
                getCurrentEmbeddingModel()
                  .then((status) => {
                    setIsModelDownloaded(status.isDownloaded);
                    if (status.isDownloaded) {
                      void loadFiles();
                    }
                  })
                  .catch(() => {});
              }
            }}
            defaultTab="embeddings"
          />
        )}
      </Dialog>
    );
  }

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
            <div className="divide-y divide-border bg-layout-content">
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