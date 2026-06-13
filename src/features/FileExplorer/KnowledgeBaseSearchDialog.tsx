import { useEffect, useMemo, useState, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Search, LoaderCircle, AlertTriangle, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import {
  searchSimilar,
  getCurrentEmbeddingModel,
  updateEmbeddingModelAndReindex,
  getModelDownloadSize,
  type KnowledgeSearchResult
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
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createTabAtom } from '@/stores/TabStore';
import { workspaceRootAtom } from '@/features/FileExplorer/store';
import { SettingsDialog } from '@/features/SettingsDialog';

interface KnowledgeBaseSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getResultPath(id: string): string | null {
  if (!id.startsWith('file:')) {
    return null;
  }

  const rawPath = id.slice(5);
  const sectionMarkerIndex = rawPath.indexOf('#section:');

  if (sectionMarkerIndex >= 0) {
    return rawPath.slice(0, sectionMarkerIndex);
  }

  return rawPath;
}

export function KnowledgeBaseSearchDialog({
  open,
  onOpenChange,
}: KnowledgeBaseSearchDialogProps) {
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KnowledgeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isModelDownloaded, setIsModelDownloaded] = useState<boolean | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null);
  const intervalRef = useRef<any>(null);
  
  const createTab = useSetAtom(createTabAtom);
  const navigate = useNavigate();

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
      setQuery('');
      setResults([]);
    }
  }, [open]);

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

  const hasQuery = query.trim().length > 0;
  const resultCountLabel = useMemo(() => {
    if (!hasQuery) return 'Enter a query to search indexed markdown documents.';
    if (isSearching) return 'Searching knowledge base…';
    return `${results.length} result${results.length === 1 ? '' : 's'}`;
  }, [hasQuery, isSearching, results.length]);

  const handleSearch = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      toast.error('Enter a search query');
      return;
    }

    setIsSearching(true);

    try {
      const nextResults = await searchSimilar(trimmedQuery, 20);
      setResults(nextResults);
    } catch (error) {
      console.error('Knowledge base search failed:', error);
      toast.error('Knowledge base search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleOpenResult = (result: KnowledgeSearchResult) => {
    const filePath = getResultPath(result.id);
    if (!filePath) {
      toast.error('This result cannot be opened from the editor yet');
      return;
    }

    createTab({
      filePath,
      fileName: result.title,
      switchTo: true,
    });
    navigate('/editor');
    onOpenChange(false);
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
              Depdok performs semantic searches using a local embedding model that runs fully offline on your device.
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
                  .then((status) => setIsModelDownloaded(status.isDownloaded))
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
          <DialogTitle>Knowledge Search</DialogTitle>
          <DialogDescription>
            Run semantic search against the indexed markdown documents in the local knowledge base.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !isSearching) {
                event.preventDefault();
                void handleSearch();
              }
            }}
            placeholder="Search similar notes, concepts, or phrases"
            disabled={isSearching}
          />
          <Button type="button" onClick={() => void handleSearch()} disabled={!hasQuery || isSearching} className="min-w-24">
            {isSearching ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Searching
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Search
              </>
            )}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">{resultCountLabel}</div>

        <div className="border border-border rounded-md min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-[420px]">
            <div className="divide-y divide-border bg-layout-content">
              {!isSearching && hasQuery && results.length === 0 && (
                <div className="px-4 py-8 text-sm text-center text-muted-foreground">
                  No results found.
                </div>
              )}

              {results.map((result) => {
                const filePath = getResultPath(result.id);

                return (
                  <button
                    key={`${result.id}-${result.distance}`}
                    type="button"
                    onClick={() => handleOpenResult(result)}
                    className="w-full text-left px-4 py-3 hover:bg-accent/40 transition-colors disabled:cursor-not-allowed"
                    disabled={!filePath}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground truncate">{result.title}</div>
                        <div className="text-xs text-muted-foreground break-all">{filePath ?? result.id}</div>
                      </div>
                      <div className="shrink-0 text-[11px] text-muted-foreground rounded-full border px-2 py-1">
                        {result.distance.toFixed(4)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}