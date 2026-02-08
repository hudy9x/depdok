import { useState, useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { toast } from 'sonner';
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
import {
  renamingNodeAtom,
  creatingNodeAtom,
  deletingNodeAtom,
  refreshDirectoryAtom,
  workspaceRootAtom,
} from './store';
import {
  createFile,
  createDirectory,
  renameNode,
  deleteNode,
} from './api';
import { tabsAtom, closeTabAtom } from '@/stores/TabStore';

export function FileOperationDialogs() {
  const [renaming, setRenaming] = useAtom(renamingNodeAtom);
  const [creating, setCreating] = useAtom(creatingNodeAtom);
  const [deleting, setDeleting] = useAtom(deletingNodeAtom);
  const refreshDirectory = useSetAtom(refreshDirectoryAtom);
  const [workspaceRoot] = useAtom(workspaceRootAtom);
  // const openWorkspace = useSetAtom(openWorkspaceAtom);
  const [tabs] = useAtom(tabsAtom);
  const closeTab = useSetAtom(closeTabAtom);

  const [nameInput, setNameInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Create Dialog ---
  useEffect(() => {
    if (creating.isOpen) {
      setNameInput('');
    }
  }, [creating.isOpen]);

  const handleCreate = async () => {
    if (!nameInput.trim() || !creating.path) return;
    setIsSubmitting(true);

    try {
      // creating.path is the parent folder
      const newPath = `${creating.path}/${nameInput}`;

      if (creating.type === 'file') {
        await createFile(newPath);
        toast.success(`File created: ${nameInput}`);
      } else {
        await createDirectory(newPath);
        toast.success(`Folder created: ${nameInput}`);
      }

      await refreshDirectory(creating.path);
      setCreating({ ...creating, isOpen: false });
    } catch (error) {
      console.error('Failed to create:', error);
      toast.error(`Failed to create ${creating.type}: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Rename Dialog ---
  useEffect(() => {
    if (renaming.isOpen && renaming.path) {
      const fileName = renaming.path.split(/[/\\]/).pop() || '';
      setNameInput(fileName);
    }
  }, [renaming.isOpen, renaming.path]);

  const handleRename = async () => {
    if (!nameInput.trim() || !renaming.path) return;
    setIsSubmitting(true);

    try {
      // Construct new path
      const pathParts = renaming.path.split(/[/\\]/);
      pathParts.pop(); // Remove old filename
      const parentPath = pathParts.join('/'); // Reconstruct parent path
      // Handle Windows backslashes if needed, but usually consistent internal path usage is best
      // Assuming path separator is forward slash or handled by environment

      // Better: get parent directory properly
      // For simplicity, assuming standard path manipulation works or we should use an API
      // Let's assume the path string manipulation is safe for now as we get paths from API
      const newPath = `${parentPath}/${nameInput}`;

      await renameNode(renaming.path, newPath);
      toast.success('Renamed successfully');

      // Refresh parent directory
      if (parentPath) {
        await refreshDirectory(parentPath);
      } else if (workspaceRoot) {
        // If it was a root item (unlikely to rename root itself via this, but items in root)
        await refreshDirectory(workspaceRoot);
      }

      setRenaming({ ...renaming, isOpen: false });
    } catch (error) {
      console.error('Failed to rename:', error);
      toast.error(`Failed to rename: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Delete Dialog ---
  const handleDelete = async () => {
    const pathsToDelete = deleting.paths || (deleting.path ? [deleting.path] : []);
    if (pathsToDelete.length === 0) return;

    setIsSubmitting(true);

    try {
      // Execute all deletes
      await Promise.all(pathsToDelete.map(path => deleteNode(path)));

      // Close tabs for deleted files/folders
      const idsToClose = new Set<string>();
      pathsToDelete.forEach(path => {
        tabs.forEach(t => {
          // Check for exact match or if it's a child of the deleted folder
          // simplistic check: if path is prefix. 
          // Normalize checks to handle potential slash differences if needed, 
          // but keeping it simple for now as per project convention (mostly forward slash).
          if (t.filePath === path || t.filePath.startsWith(`${path}/`)) {
            idsToClose.add(t.id);
          }
        });
      });

      idsToClose.forEach(id => closeTab(id));

      toast.success(pathsToDelete.length > 1
        ? `Deleted ${pathsToDelete.length} items`
        : 'Deleted successfully'
      );

      // Refresh parent directories
      // We collect unique parent paths to refresh
      const parentsToRefresh = new Set<string>();
      if (workspaceRoot) parentsToRefresh.add(workspaceRoot); // Always refresh root to be safe or intelligent

      for (const path of pathsToDelete) {
        const parent = path.split(/[/\\]/).slice(0, -1).join('/');
        if (parent) parentsToRefresh.add(parent);
      }

      // Refresh them
      for (const parent of parentsToRefresh) {
        await refreshDirectory(parent);
      }

      setDeleting({ ...deleting, isOpen: false });
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error(`Failed to delete: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Create Dialog */}
      <Dialog open={creating.isOpen} onOpenChange={(open) => setCreating({ ...creating, isOpen: open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New {creating.type === 'file' ? 'File' : 'Folder'}</DialogTitle>
            <DialogDescription>
              Enter the name for the new {creating.type === 'file' ? 'file' : 'folder'}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={creating.type === 'file' ? 'filename.md' : 'New Folder'}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating({ ...creating, isOpen: false })}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSubmitting}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renaming.isOpen} onOpenChange={(open) => setRenaming({ ...renaming, isOpen: open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming({ ...renaming, isOpen: false })}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={isSubmitting}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleting.isOpen} onOpenChange={(open) => setDeleting({ ...deleting, isOpen: open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete
              {deleting.paths && deleting.paths.length > 1 ? (
                <span className="font-semibold block mt-1">
                  {deleting.paths.length} items
                </span>
              ) : (
                <span className="font-semibold block mt-1 break-all">
                  {deleting.path?.split(/[/\\]/).pop()}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting({ ...deleting, isOpen: false })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
