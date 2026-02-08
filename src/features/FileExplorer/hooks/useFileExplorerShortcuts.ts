import { useAtomValue, useSetAtom } from 'jotai';
import {
  workspaceRootAtom,
  selectedPathsAtom,
  renamingNodeAtom,
  creatingNodeAtom,
} from '../store';
import { useFileOperations } from '../useFileOperations';

export function useFileExplorerShortcuts() {
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const selectedPaths = useAtomValue(selectedPathsAtom);
  const setSelectedPaths = useSetAtom(selectedPathsAtom);
  const renaming = useAtomValue(renamingNodeAtom);
  const creating = useAtomValue(creatingNodeAtom);
  const { cut, copy, paste, deleteItems, clearClipboard } = useFileOperations();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // If a dialog is open (renaming or creating), don't trigger shortcuts
    if (renaming.isOpen || creating.isOpen) {
      return;
    }

    // Check modifiers
    const isCmdOrCtrl = e.metaKey || e.ctrlKey;

    if (isCmdOrCtrl) {
      switch (e.key) {
        case 'c':
          e.preventDefault();
          if (selectedPaths.size > 0) copy(Array.from(selectedPaths));
          break;
        case 'x':
          e.preventDefault();
          if (selectedPaths.size > 0) cut(Array.from(selectedPaths));
          break;
        case 'v':
          e.preventDefault();
          // Determine destination
          // If 1 item selected and is folder -> paste there
          // Else paste in parent of first selected item
          // Else paste in workspaceRoot
          let dest = workspaceRoot;
          if (selectedPaths.size === 1) {
            const path = Array.from(selectedPaths)[0];
            // simplified check: just try to paste in parent usually, or if folder.
            // We need to know if it's a folder. We can check fileTreeData or just assume passing path is fine if folder?
            // `paste` hook function takes `destinationFolder`.
            // We can't easily know if path is folder without looking up in tree or checking extension/metadata.
            // For now, let's look up in fileTreeData (but it maps folders -> entries, not easily reverse lookup).
            // Let's assume selecting a file -> paste in parent. Selecting a folder -> paste inside?
            // Actually, Windows Explorer: Paste always goes to current directory.
            // File Tree item selection usually implies "this is the target".
            // Let's use parent of selected item for safety, unless we implement robust isFolder check.
            // Actually, I can check if path is in `fileTreeData` keys (loaded folders) but that's partial.
            // Let's stick to parent folder of selected item to be safe and consistent with Context Menu "New File" logic default.
            // Wait, context menu "New File" logic: if folder, create inside.
            // I don't have `isFolder` here easily.
            // Let's try to infer from data or just paste in parent.
            if (path) {
              dest = path.split(/[/\\]/).slice(0, -1).join('/') || workspaceRoot;
            }
          } else if (selectedPaths.size > 0) {
            const first = Array.from(selectedPaths)[0];
            dest = first.split(/[/\\]/).slice(0, -1).join('/') || workspaceRoot;
          }
          if (dest) paste(dest);
          break;
      }
    } else {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Avoid deleting if renaming or input active?
        // But here we are on the div.
        if (selectedPaths.size > 0) {
          e.preventDefault();
          deleteItems(Array.from(selectedPaths));
        }
      } else if (e.key === 'Escape') {
        // Cancel cut/copy
        e.preventDefault();
        clearClipboard();
        setSelectedPaths(new Set());
      }
    }
  };

  return { handleKeyDown };
}
