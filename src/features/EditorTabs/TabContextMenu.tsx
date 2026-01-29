import { useState } from 'react';
import { useSetAtom } from 'jotai';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { toast } from 'sonner';
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
import { RenameTabDialog } from './RenameTabDialog';

interface TabContextMenuProps {
  tab: Tab;
  children: React.ReactNode;
}

export function TabContextMenu({ tab, children }: TabContextMenuProps) {
  const closeTab = useSetAtom(closeTabAtom);
  const closeOtherTabs = useSetAtom(closeOtherTabsAtom);
  const closeAllTabs = useSetAtom(closeAllTabsAtom);
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
            Rename
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleCloseOthers}>
            Close Others
          </ContextMenuItem>
          <ContextMenuItem onClick={handleCloseAll}>
            Close All
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleCopyFilename}>
            Copy File Name
          </ContextMenuItem>
          <ContextMenuItem
            onClick={handleCopyFilePath}
            disabled={isDummyPath(tab.filePath)}
          >
            Copy File Path
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleClose}>
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
