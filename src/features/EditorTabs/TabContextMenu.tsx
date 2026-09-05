import { ExportContextMenuItem } from '@/features/PreviewMarkdown/ExportContextMenuItem';
import { useState } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { toast } from 'sonner';
import {
  Pencil,
  XCircle,
  FileSearch,
  FileText,
  ClipboardCopy,
  Columns2,
  Rows,
  RotateCw,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  closeOtherTabsAtom,
  closeAllTabsAtom,
  isDummyPath,
  type Tab,
} from '@/stores/TabStore';
import { activePaneIdAtom, splitPaneAtom } from '@/stores/PaneStore';
import { revealFileAtom, isFileExplorerVisibleAtom } from '@/features/FileExplorer/store';
import {
  liveFilesContentAtom,
  clearLiveFileWriterAtom,
  triggerFileReloadAtom,
} from '@/stores/EditorStore';
import { markFileAsSavedAtom } from '@/stores/DirtyStore';
import { readFileContent } from '@/lib/fileOperations';
import { draftService } from '@/lib/indexeddb';
import { RenameTabDialog } from './RenameTabDialog';

interface TabContextMenuProps {
  tab: Tab;
  paneId?: string;
  children: React.ReactNode;
}

export function TabContextMenu({ tab, paneId, children }: TabContextMenuProps) {
  const activePaneId = useAtomValue(activePaneIdAtom);
  const targetPaneId = paneId || activePaneId;
  const closeOtherTabs = useSetAtom(closeOtherTabsAtom);
  const closeAllTabs = useSetAtom(closeAllTabsAtom);
  const splitPane = useSetAtom(splitPaneAtom);
  const revealFile = useSetAtom(revealFileAtom);
  const setFileExplorerVisible = useSetAtom(isFileExplorerVisibleAtom);
  const setLiveFilesContent = useSetAtom(liveFilesContentAtom);
  const clearLiveFileWriter = useSetAtom(clearLiveFileWriterAtom);
  const triggerFileReload = useSetAtom(triggerFileReloadAtom);
  const markFileAsSaved = useSetAtom(markFileAsSavedAtom);
  const [showRenameDialog, setShowRenameDialog] = useState(false);

  const handleRename = () => {
    setShowRenameDialog(true);
  };

  const handleReloadFile = async () => {
    if (isDummyPath(tab.filePath)) return;
    try {
      const diskContent = await readFileContent(tab.filePath);
      await draftService.removeDraft(tab.filePath);
      markFileAsSaved(tab.filePath);
      clearLiveFileWriter(tab.filePath);
      setLiveFilesContent((prev) => ({
        ...prev,
        [tab.filePath]: diskContent,
      }));
      triggerFileReload(tab.filePath);
      toast.success('Reloaded file from disk');
    } catch (err) {
      toast.error(`Failed to reload file: ${String(err)}`);
    }
  };

  const handleCloseOthers = () => {
    closeOtherTabs({ tabId: tab.id, paneId: targetPaneId });
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
    if (isDummyPath(tab.filePath)) {
      toast.info('Save the file first to copy its path');
      return;
    }

    await writeText(tab.filePath);
    toast.success('Copied full path');
  };

  const handleRevealInExplorer = () => {
    if (isDummyPath(tab.filePath)) {
      toast.info('Save the file first to reveal it in explorer');
      return;
    }

    setFileExplorerVisible(true);
    revealFile(tab.filePath);
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
          <ContextMenuItem
            onClick={handleReloadFile}
            disabled={isDummyPath(tab.filePath)}
          >
            <RotateCw className="mr-2 h-4 w-4" />
            Reload File
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => splitPane({ paneId: targetPaneId, direction: 'horizontal' })}>
            <Columns2 className="mr-2 h-4 w-4" />
            Split Right
          </ContextMenuItem>
          <ContextMenuItem onClick={() => splitPane({ paneId: targetPaneId, direction: 'vertical' })}>
            <Rows className="mr-2 h-4 w-4" />
            Split Down
          </ContextMenuItem>

          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={handleRevealInExplorer}
            disabled={isDummyPath(tab.filePath)}
          >
            <FileSearch className="mr-2 h-4 w-4" />
            Reveal in Explorer
          </ContextMenuItem>
          <ExportContextMenuItem filePath={tab.filePath} />
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
          <ContextMenuItem onClick={handleCloseOthers}>
            <XCircle className="mr-2 h-4 w-4" />
            Close Others
          </ContextMenuItem>
          <ContextMenuItem onClick={handleCloseAll}>
            <XCircle className="mr-2 h-4 w-4" />
            Close All
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
