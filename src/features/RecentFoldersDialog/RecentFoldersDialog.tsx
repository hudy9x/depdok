import { useAtomValue, useSetAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { PiFolderSimpleFill, PiFolderPlusFill } from 'react-icons/pi';
import { Check, X, Clock, Folder } from 'lucide-react';
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

  const latestFolders = recentFolders.slice(0, 2);

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
      <DialogContent className="!fixed !top-4 !bottom-4 !left-4 !right-4 sm:!top-6 sm:!bottom-6 sm:!left-6 sm:!right-6 !z-50 !w-auto !h-auto !max-w-none sm:!max-w-none !max-h-none !translate-x-0 !translate-y-0 !transform-none !rounded-lg border border-border/50 bg-background/95 shadow-2xl p-6 sm:p-10 flex flex-col justify-between overflow-hidden duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Select Folder</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col max-w-5xl w-full mx-auto justify-center py-4 min-h-0">
          <ScrollArea className="flex-1 max-h-full pr-4">
            <div className="flex flex-col gap-8">


              {/* Section 2: All Recent Folders */}
              <div>
                <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none">
                  <Folder className="w-3.5 h-3.5" />
                  <span>Recent Folders</span>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {/* First Item in All Folders: Open Folder... */}
                  <button
                    onClick={handleOpenFolderDialog}
                    title="Open Folder from disk"
                    className="group relative flex flex-col items-center justify-between p-4 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer text-center select-none"
                  >
                    <div className="relative my-2 flex items-center justify-center">
                      <PiFolderPlusFill className="w-20 h-20 text-muted-foreground/50 group-hover:text-primary transition-colors duration-150" />
                    </div>
                    <div className="w-full min-w-0 mt-1">
                      <p className="text-xs font-medium text-foreground line-clamp-2 break-words leading-tight w-full">
                        Open Folder...
                      </p>
                    </div>
                  </button>

                  {/* All Recent Folders */}
                  {recentFolders.map((folderPath) => {
                    const isActive = workspaceRoot === folderPath;
                    const folderName = getFolderName(folderPath);

                    return (
                      <button
                        key={`all-${folderPath}`}
                        onClick={() => handleSelectFolder(folderPath)}
                        title={folderPath}
                        className="group relative flex flex-col items-center justify-between p-4 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer text-center select-none"
                      >
                        <span
                          onClick={(e) => handleRemoveFolder(e, folderPath)}
                          title="Remove from recent history"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded-md hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors cursor-pointer z-10"
                        >
                          <X className="h-3.5 w-3.5" />
                        </span>

                        <div className="relative my-2 flex items-center justify-center">
                          <PiFolderSimpleFill className="w-20 h-20 text-amber-500/80 group-hover:text-amber-400 transition-colors duration-150" />
                          {isActive && (
                            <span
                              className="absolute top-3 right-0 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs"
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
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
