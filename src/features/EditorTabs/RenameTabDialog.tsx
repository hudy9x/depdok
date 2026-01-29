import { useState, useEffect } from 'react';
import { useSetAtom } from 'jotai';
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
import { updateTabAtom, type Tab } from '@/stores/TabStore';

interface RenameTabDialogProps {
  tab: Tab;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenameTabDialog({ tab, open, onOpenChange }: RenameTabDialogProps) {
  const updateTab = useSetAtom(updateTabAtom);
  const [newName, setNewName] = useState(tab.fileName);

  // Reset the input when the dialog opens
  useEffect(() => {
    if (open) {
      setNewName(tab.fileName);
    }
  }, [open, tab.fileName]);

  const handleRename = () => {
    if (!newName.trim()) return;

    // Extract extension from new name
    const parts = newName.split('.');
    const fileExtension = parts.length > 1 ? parts[parts.length - 1] : null;

    // Update the tab with new name
    updateTab({
      tabId: tab.id,
      updates: {
        fileName: newName,
        fileExtension,
        // Update filePath for UNTITLED files
        filePath: tab.filePath.startsWith('UNTITLED://')
          ? `UNTITLED://${newName}`
          : tab.filePath,
      },
    });

    onOpenChange(false);
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
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleRename} disabled={!newName.trim()}>
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
