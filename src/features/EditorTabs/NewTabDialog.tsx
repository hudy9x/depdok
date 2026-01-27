import { useState } from 'react';
import { useSetAtom } from 'jotai';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { createUntitledTabAtom } from '@/stores/TabStore';
import { draftService } from '@/lib/indexeddb';
import { toast } from 'sonner';

interface NewTabDialogProps {
  open: boolean;
  onClose: () => void;
}

const SUPPORTED_EXTENSIONS = ['md', 'mmd', 'todo', 'plantuml'];

export function NewTabDialog({ open, onClose }: NewTabDialogProps) {
  const [filename, setFilename] = useState('');
  const [error, setError] = useState('');
  const createUntitledTab = useSetAtom(createUntitledTabAtom);

  const validateFilename = (name: string): boolean => {
    if (!name.trim()) {
      setError('Filename cannot be empty');
      return false;
    }

    const parts = name.split('.');
    if (parts.length < 2) {
      setError('Filename must include an extension (.md, .mmd, .todo, .plantuml)');
      return false;
    }

    const extension = parts[parts.length - 1].toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      setError(`Unsupported extension. Use: ${SUPPORTED_EXTENSIONS.join(', ')}`);
      return false;
    }

    setError('');
    return true;
  };

  const handleCreate = async () => {
    if (!validateFilename(filename)) {
      return;
    }

    try {
      // Create the tab with UNTITLED:// path
      createUntitledTab(filename);

      // Initialize empty draft in IndexedDB
      const dummyPath = `UNTITLED://${filename}`;
      await draftService.saveDraft(dummyPath, '');

      toast.success(`Created ${filename}`);
      onClose();
      setFilename('');
      setError('');
    } catch (err) {
      console.error('Error creating tab:', err);
      toast.error('Failed to create file');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New File</DialogTitle>
          <DialogDescription>
            Enter a filename with one of these extensions: .md, .mmd, .todo, .plantuml
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="filename">Filename</Label>
            <Input
              id="filename"
              placeholder="example.md"
              value={filename}
              onChange={(e) => {
                setFilename(e.target.value);
                setError('');
              }}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
