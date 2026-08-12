import { useAtomValue, useSetAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { PiFolderSimpleFill, PiFolderPlusFill } from 'react-icons/pi';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  recentFoldersAtom,
  removeRecentFolderAtom,
  openWorkspaceAtom,
  workspaceRootAtom,
} from '@/features/FileExplorer/store';
import { openFolderDialog } from '@/features/FileExplorer/api';

interface RecentFoldersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecentFoldersDialog({ open, onOpenChange }: RecentFoldersDialogProps) {
  const recentFolders = useAtomValue(recentFoldersAtom);
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const openWorkspace = useSetAtom(openWorkspaceAtom);
  const removeRecentFolder = useSetAtom(removeRecentFolderAtom);
  const navigate = useNavigate();

  const handleSelectFolder = async (path: string) => {
    try {
      await openWorkspace(path);
      onOpenChange(false);
      navigate('/editor');
    } catch (error) {
      console.error('Failed to open recent folder:', error);
      toast.error('Failed to open folder');
    }
  };

  const handleRemoveFolder = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    removeRecentFolder(path);
    toast.success('Removed folder from recent history');
  };

  const handleOpenFolderDialog = async () => {
    try {
      const folderPath = await openFolderDialog();
      if (folderPath) {
        await openWorkspace(folderPath);
        onOpenChange(false);
        navigate('/editor');
      }
    } catch (error) {
      console.error('Failed to open folder dialog:', error);
      toast.error('Failed to open folder');
    }
  };

  const getFolderName = (path: string) => {
    const parts = path.split(/[/\\]/);
    return parts.pop() || path;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-6">
        <DialogHeader className="sr-only">
          <DialogTitle>Select Folder</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[440px] pt-1 pb-2 pr-3 -mr-3">
          <div className="grid grid-cols-4 gap-3">
            {/* First Item: Open Folder... */}
            <button
              onClick={handleOpenFolderDialog}
              title="Open Folder from disk"
              className="group relative flex flex-col items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-all cursor-pointer text-center select-none"
            >
              <div className="relative my-1 flex items-center justify-center">
                <PiFolderPlusFill className="w-18 h-18 text-muted-foreground/60 group-hover:text-primary transition-all duration-150 group-hover:scale-105" />
              </div>
              <div className="w-full min-w-0 mt-1">
                <p className="text-xs font-medium text-foreground line-clamp-2 break-words leading-tight w-full">
                  Open Folder...
                </p>
              </div>
            </button>

            {/* Recent Folders */}
            {recentFolders.map((folderPath) => {
              const isActive = workspaceRoot === folderPath;
              const folderName = getFolderName(folderPath);

              return (
                <button
                  key={folderPath}
                  onClick={() => handleSelectFolder(folderPath)}
                  title={folderPath}
                  className="group relative flex flex-col items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-all cursor-pointer text-center select-none"
                >
                  <span
                    onClick={(e) => handleRemoveFolder(e, folderPath)}
                    title="Remove from recent history"
                    className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded-md hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-all cursor-pointer z-10"
                  >
                    <X className="h-3.5 w-3.5" />
                  </span>

                  <div className="relative my-1 flex items-center justify-center">
                    <PiFolderSimpleFill className="w-18 h-18 text-amber-500/90 group-hover:text-amber-500 transition-transform duration-150 group-hover:scale-105" />
                    {isActive && (
                      <span
                        className="absolute -top-1 -left-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs"
                        title="Current Active Workspace"
                      >
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>

                  <div className="w-full min-w-0 mt-1">
                    <p className="text-xs font-medium text-foreground line-clamp-2 break-words leading-tight w-full">
                      {folderName}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
