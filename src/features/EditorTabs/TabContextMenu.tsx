import { useState } from 'react';
import { useSetAtom } from 'jotai';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { toast } from 'sonner';
import {
  Pencil,
  X,
  XCircle,
  FileSearch,
  FileText,
  ClipboardCopy,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  closeTabAtom,
  closeOtherTabsAtom,
  closeAllTabsAtom,
  isDummyPath,
  type Tab,
} from '@/stores/TabStore';
import { revealFileAtom, isFileExplorerVisibleAtom } from '@/features/FileExplorer/store';
import { RenameTabDialog } from './RenameTabDialog';

interface TabContextMenuProps {
  tab: Tab;
  children: React.ReactNode;
}

export function TabContextMenu({ tab, children }: TabContextMenuProps) {
  const closeTab = useSetAtom(closeTabAtom);
  const closeOtherTabs = useSetAtom(closeOtherTabsAtom);
  const closeAllTabs = useSetAtom(closeAllTabsAtom);
  const revealFile = useSetAtom(revealFileAtom);
  const setFileExplorerVisible = useSetAtom(isFileExplorerVisibleAtom);
  const [showRenameDialog, setShowRenameDialog] = useState(false);

  const handleRename = () => {
    setShowRenameDialog(true);
  };

  const handleCloseOthers = () => {
    closeOtherTabs(tab.id);
  };

  const handleCloseAll = () => {
    closeAllTabs();
  };

  const handleCopyFilename = async () => {
    const filename = tab.fileName;
    await writeText(filename);
    toast.success(`Copied: ${filename}`);
  };

  const handleCopyFilePath = async () => {
    // Don't allow copying for UNTITLED:// paths
    if (isDummyPath(tab.filePath)) {
      toast.info('Save the file first to copy its path');
      return;
    }

    await writeText(tab.filePath);
    toast.success('Copied full path');
  };

  const handleRevealInExplorer = () => {
    // Don't allow revealing for UNTITLED:// paths
    if (isDummyPath(tab.filePath)) {
      toast.info('Save the file first to reveal it in explorer');
      return;
    }

    // Open FileExplorer if it's closed
    setFileExplorerVisible(true);

    // Reveal the file
    revealFile(tab.filePath);
  };

  const handleClose = () => {
    closeTab(tab.id);
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={handleRename}>
            <Pencil className="mr-2 h-4 w-4" />
            Rename
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleCloseOthers}>
            <XCircle className="mr-2 h-4 w-4" />
            Close Others
          </ContextMenuItem>
          <ContextMenuItem onClick={handleCloseAll}>
            <XCircle className="mr-2 h-4 w-4" />
            Close All
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={handleRevealInExplorer}
            disabled={isDummyPath(tab.filePath)}
          >
            <FileSearch className="mr-2 h-4 w-4" />
            Reveal in Explorer
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleCopyFilename}>
            <FileText className="mr-2 h-4 w-4" />
            Copy File Name
          </ContextMenuItem>
          <ContextMenuItem
            onClick={handleCopyFilePath}
            disabled={isDummyPath(tab.filePath)}
          >
            <ClipboardCopy className="mr-2 h-4 w-4" />
            Copy File Path
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleClose}>
            <X className="mr-2 h-4 w-4" />
            Close
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <RenameTabDialog
        tab={tab}
        open={showRenameDialog}
        onOpenChange={setShowRenameDialog}
      />
    </>
  );
}
