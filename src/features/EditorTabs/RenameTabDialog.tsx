import { useState, useEffect } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { toast } from 'sonner';
import { renameFile } from '@/lib/fileOperations';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateTabAtom, isDummyPath, activeTabAtom, type Tab } from '@/stores/TabStore';
import { draftService } from '@/lib/indexeddb';
import { filePathAtom } from '@/stores/EditorStore';

interface RenameTabDialogProps {
  tab: Tab;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenameTabDialog({ tab, open, onOpenChange }: RenameTabDialogProps) {
  const updateTab = useSetAtom(updateTabAtom);
  const activeTab = useAtomValue(activeTabAtom);
  const setFilePath = useSetAtom(filePathAtom);
  const [newName, setNewName] = useState(tab.fileName);
  const [isRenaming, setIsRenaming] = useState(false);

  // Reset the input when the dialog opens
  useEffect(() => {
    if (open) {
      setNewName(tab.fileName);
    }
  }, [open, tab.fileName]);

  const handleRename = async () => {
    if (!newName.trim()) return;

    setIsRenaming(true);

    try {
      // Extract extension from new name
      const parts = newName.split('.');
      const fileExtension = parts.length > 1 ? parts[parts.length - 1] : null;

      // If it's a real file (not UNTITLED), rename it on disk
      if (!isDummyPath(tab.filePath)) {
        // Get the directory path
        const pathParts = tab.filePath.split('/');
        pathParts.pop(); // Remove the old filename
        const directory = pathParts.join('/');
        const newPath = `${directory}/${newName}`;

        // Rename the actual file on disk
        await renameFile(tab.filePath, newPath);

        // Rename the draft in IndexedDB if it exists
        await draftService.renameDraft(tab.filePath, newPath);

        // Update the tab with new name and path
        updateTab({
          tabId: tab.id,
          updates: {
            fileName: newName,
            fileExtension,
            filePath: newPath,
          },
        });

        // If this is the active tab, update the editor state as well
        if (activeTab?.id === tab.id) {
          setFilePath(newPath);
        }

        toast.success(`Renamed to ${newName}`);
      } else {
        // For UNTITLED files, just update the name in the store
        updateTab({
          tabId: tab.id,
          updates: {
            fileName: newName,
            fileExtension,
            filePath: `UNTITLED://${newName}`,
          },
        });

        toast.success(`Renamed to ${newName}`);
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Error renaming file:', error);
      toast.error('Failed to rename file');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRename();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rename File</DialogTitle>
          <DialogDescription>
            Enter a new name for the file. The file extension will be automatically detected.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="filename">File name</Label>
            <Input
              id="filename"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter file name..."
              autoFocus
              disabled={isRenaming}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRenaming}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRename}
            disabled={!newName.trim() || isRenaming}
          >
            {isRenaming ? 'Renaming...' : 'Rename'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
