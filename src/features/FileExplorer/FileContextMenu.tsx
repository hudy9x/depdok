import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
  Copy,
  ExternalLink,
  ClipboardCopy,
  Scissors,
  ClipboardPaste,
} from 'lucide-react';
import { useSetAtom, useAtomValue } from 'jotai';
import {
  openRenameDialogAtom,
  openCreateDialogAtom,
  refreshDirectoryAtom,
  workspaceRootAtom,
  selectedPathsAtom,
} from './store';
import { copyNode, revealFile } from './api';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { toast } from 'sonner';
import { useFileOperations } from './useFileOperations';

interface FileContextMenuProps {
  path: string;
  isFolder: boolean;
  children: React.ReactNode;
}

export function FileContextMenu({ path, isFolder, children }: FileContextMenuProps) {
  const openRenameDialog = useSetAtom(openRenameDialogAtom);
  const openCreateDialog = useSetAtom(openCreateDialogAtom);
  const refreshDirectory = useSetAtom(refreshDirectoryAtom);
  const selectedPaths = useAtomValue(selectedPathsAtom);
  const workspaceRoot = useAtomValue(workspaceRootAtom);

  const { cut, copy, paste, deleteItems, clipboard } = useFileOperations();

  const isMultiSelect = selectedPaths.size > 1 && selectedPaths.has(path);
  const effectivePaths = isMultiSelect ? Array.from(selectedPaths) : [path];

  const handleCreateFile = () => {
    const parentPath = isFolder ? path : path.split(/[/\\]/).slice(0, -1).join('/');
    openCreateDialog({ path: parentPath, type: 'file' });
  };

  const handleCreateFolder = () => {
    const parentPath = isFolder ? path : path.split(/[/\\]/).slice(0, -1).join('/');
    openCreateDialog({ path: parentPath, type: 'folder' });
  };

  const handleDuplicate = async () => {
    try {
      const fileName = path.split(/[/\\]/).pop() || '';
      const parentPath = path.split(/[/\\]/).slice(0, -1).join('/');
      const newPath = `${parentPath}/Copy of ${fileName}`;

      await copyNode(path, newPath);
      toast.success('Duplicated successfully');
      await refreshDirectory(parentPath);
    } catch (error) {
      console.error('Failed to duplicate:', error);
      toast.error('Failed to duplicate');
    }
  };

  const handleCopyPath = async () => {
    await writeText(path);
    toast.success('Path copied to clipboard');
  };

  const handleCopyRelativePath = async () => {
    if (!workspaceRoot) {
      await writeText(path);
      toast.success('Path copied to clipboard');
      return;
    }

    let relativePath = path;
    if (path.startsWith(workspaceRoot)) {
      relativePath = path.substring(workspaceRoot.length);
      if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
        relativePath = relativePath.substring(1);
      }
    }

    await writeText(relativePath);
    toast.success('Relative path copied to clipboard');
  };

  const handleReveal = async () => {
    try {
      await revealFile(path);
    } catch (error) {
      console.error('Failed to reveal:', error);
      toast.error('Failed to reveal file');
    }
  };

  // --- Clipboard Operations ---

  // --- Clipboard Operations ---

  const handleCut = () => {
    cut(effectivePaths);
  };

  const handleCopy = () => {
    copy(effectivePaths);
  };

  const handlePaste = () => {
    const destinationFolder = isFolder ? path : path.split(/[/\\]/).slice(0, -1).join('/');
    paste(destinationFolder);
  };

  const handleDelete = () => {
    deleteItems(effectivePaths);
  };


  if (isMultiSelect) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem disabled>
            <Copy className="mr-2 h-4 w-4" />
            {effectivePaths.length} items selected
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleCut}>
            <Scissors className="mr-2 h-4 w-4" />
            Cut
          </ContextMenuItem>
          <ContextMenuItem onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </ContextMenuItem>
          <ContextMenuItem onClick={handlePaste} disabled={!clipboard}>
            <ClipboardPaste className="mr-2 h-4 w-4" />
            Paste
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-600">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={handleCreateFile}>
          <FilePlus className="mr-2 h-4 w-4" />
          New File
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCreateFolder}>
          <FolderPlus className="mr-2 h-4 w-4" />
          New Folder
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => openRenameDialog(path)}>
          <Pencil className="mr-2 h-4 w-4" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={handleDuplicate}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate File
        </ContextMenuItem>
        <ContextMenuItem onClick={handleReveal}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Reveal in Folder
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleCut}>
          <Scissors className="mr-2 h-4 w-4" />
          Cut
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopy}>
          <Copy className="mr-2 h-4 w-4" />
          Copy
        </ContextMenuItem>
        <ContextMenuItem onClick={handlePaste} disabled={!clipboard}>
          <ClipboardPaste className="mr-2 h-4 w-4" />
          Paste
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleCopyRelativePath}>
          <ClipboardCopy className="mr-2 h-4 w-4" />
          Copy Relative Path
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopyPath}>
          <ClipboardCopy className="mr-2 h-4 w-4" />
          Copy Full Path
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={handleDelete}
          className="text-red-600 focus:text-red-600"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
