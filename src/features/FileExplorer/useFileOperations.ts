import { useAtom, useSetAtom } from 'jotai';
import { toast } from 'sonner';
import {
  clipboardAtom,
  deletingNodeAtom,
  refreshDirectoryAtom,
} from './store';
import { copyNode, renameNode } from './api';
import { tabsAtom } from '@/stores/TabStore';

export function useFileOperations() {
  const [clipboard, setClipboard] = useAtom(clipboardAtom);
  const setDeleting = useSetAtom(deletingNodeAtom);
  const refreshDirectory = useSetAtom(refreshDirectoryAtom);
  const [tabs, setTabs] = useAtom(tabsAtom);

  const clearClipboard = () => {
    setClipboard(null);
  };

  const cut = (paths: string[]) => {
    setClipboard({ paths, op: 'cut' });
    toast.success(`Cut ${paths.length} item(s)`);
  };

  const copy = (paths: string[]) => {
    setClipboard({ paths, op: 'copy' });
    toast.success(`Copied ${paths.length} item(s)`);
  };

  const paste = async (destinationFolder: string) => {
    if (!clipboard || clipboard.paths.length === 0) return;

    try {
      await Promise.all(clipboard.paths.map(async (srcPath) => {
        const fileName = srcPath.split(/[/\\]/).pop() || '';
        let destPath = `${destinationFolder}/${fileName}`;

        // Simple conflict avoidance
        if (srcPath === destPath && clipboard.op === 'copy') {
          destPath = `${destinationFolder}/Copy of ${fileName}`;
        }

        // Don't overwrite if dest exists unless same src?
        // Wait, for cut it means move. If dest exists, renameNode fails?
        // Let's assume renameNode/fs::rename handles overwrite or error.

        if (clipboard.op === 'copy') {
          await copyNode(srcPath, destPath);
        } else {
          // Check if cut op and path conflict
          // If srcPath == destPath, do nothing (same file)
          if (srcPath === destPath) return;
          await renameNode(srcPath, destPath);

          // Update tabs if file was open
          const tabToUpdate = tabs.find(t => t.filePath === srcPath);
          if (tabToUpdate) {
            const newFileName = destPath.split(/[/\\]/).pop() || '';
            const newExtension = newFileName.split('.').pop() || null;
            setTabs(prev => prev.map(t => t.id === tabToUpdate.id ? {
              ...t,
              filePath: destPath,
              fileName: newFileName,
              fileExtension: newExtension
            } : t));
          }
        }
      }));

      toast.success('Pasted successfully');
      await refreshDirectory(destinationFolder);

      if (clipboard.op === 'cut') {
        // Refresh parent of first source item as a best guess for update
        const srcParent = clipboard.paths[0].split(/[/\\]/).slice(0, -1).join('/');
        if (srcParent && srcParent !== destinationFolder) {
          await refreshDirectory(srcParent);
        }
        setClipboard(null);
      }
    } catch (error) {
      console.error('Failed to paste:', error);
      toast.error(`Failed to paste: ${error}`);
    }
  };

  const deleteItems = (paths: string[]) => {
    if (paths.length === 0) return;
    setDeleting({ isOpen: true, paths, path: null });
  };

  return {
    cut,
    copy,
    paste,
    deleteItems,
    clipboard,
    clearClipboard
  };
}
