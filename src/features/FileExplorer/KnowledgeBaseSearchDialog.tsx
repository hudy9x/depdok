import { useMemo, useState } from 'react';
import { useSetAtom } from 'jotai';
import { Search, LoaderCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { searchSimilar, type KnowledgeSearchResult } from '@/api-client/knowledge-base';
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
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KnowledgeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const createTab = useSetAtom(createTabAtom);
  const navigate = useNavigate();

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