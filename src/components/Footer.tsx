import { useEffect, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { GitBranch, RefreshCw, FileCode, Terminal } from 'lucide-react';
import { toast } from 'sonner';

import { workspaceRootAtom } from '@/features/FileExplorer/store';
import { branchSelectorOpenAtom } from '@/features/BranchSelector/store';
import { activeTabAtom } from '@/stores/TabStore';
import { getCurrentBranch, gitPull, getGitSyncStatus, startWatchingGit, stopWatchingGit, onGitChanged, isGitRepository } from '@/lib/gitUtils';
import { cn } from '@/lib/utils';

export function Footer() {
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const activeTab = useAtomValue(activeTabAtom);
  const setBranchSelectorOpen = useSetAtom(branchSelectorOpenAtom);

  const [branch, setBranch] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<{ ahead: number; behind: number }>({ ahead: 0, behind: 0 });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number } | null>(null);

  // 1. Fetch Git info (branch & sync status) if workspace root changes
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const fetchGitInfo = async () => {
      if (workspaceRoot) {
        try {
          const isGit = await isGitRepository(workspaceRoot);
          if (!isGit) {
            setBranch('');
            setSyncStatus({ ahead: 0, behind: 0 });
            return;
          }

          const [currentBranch, status] = await Promise.all([
            getCurrentBranch(workspaceRoot),
            getGitSyncStatus(workspaceRoot)
          ]);
          setBranch(currentBranch || 'main');
          setSyncStatus(status || { ahead: 0, behind: 0 });
        } catch (error) {
          console.error('Failed to fetch Git info:', error);
        }
      } else {
        setBranch('');
        setSyncStatus({ ahead: 0, behind: 0 });
      }
    };

    const setupGitWatcher = async () => {
      if (workspaceRoot) {
        const isGit = await isGitRepository(workspaceRoot);
        if (!isGit) return;

        await startWatchingGit(workspaceRoot);
        unlisten = await onGitChanged(() => {
          fetchGitInfo();
        });
      }
    };

    fetchGitInfo();
    setupGitWatcher();

    // Check periodically (every 10s)
    const interval = setInterval(fetchGitInfo, 500);

    return () => {
      clearInterval(interval);
      if (unlisten) unlisten();
      stopWatchingGit();
    };
  }, [workspaceRoot]);

  // 2. Listen to custom editor cursor events from MonacoEditor
  useEffect(() => {
    const handleCursorChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ lineNumber: number; column: number } | null>;
      if (customEvent.detail) {
        setCursorPos({
          line: customEvent.detail.lineNumber,
          col: customEvent.detail.column
        });
      } else {
        setCursorPos(null);
      }
    };

    window.addEventListener('editor-cursor', handleCursorChange);
    return () => {
      window.removeEventListener('editor-cursor', handleCursorChange);
    };
  }, []);

  // 3. Handle Git Sync (Pull) interaction
  const handleGitSync = async () => {
    if (!workspaceRoot) {
      toast.info('No active workspace open');
      return;
    }

    setIsSyncing(true);
    const toastId = toast.loading('Performing Git sync pull...');

    try {
      const result = await gitPull(workspaceRoot);
      if (result.success) {
        toast.success('Git pull sync complete', { id: toastId });
        // Refresh branch and sync status
        const [current, status] = await Promise.all([
          getCurrentBranch(workspaceRoot),
          getGitSyncStatus(workspaceRoot)
        ]);
        setBranch(current || 'main');
        setSyncStatus(status || { ahead: 0, behind: 0 });
      } else {
        toast.error(`Sync failed: ${result.output}`, { id: toastId });
      }
    } catch (error) {
      console.error('Failed Git pull sync:', error);
      toast.error('Sync failed with system error', { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  const getWorkspaceName = () => {
    if (!workspaceRoot) return '';
    return workspaceRoot.split(/[/\\]/).pop() || 'WORKSPACE';
  };

  const getLanguageLabel = () => {
    if (!activeTab) return '';
    const ext = activeTab.fileExtension?.toLowerCase() || '';
    if (ext === 'md' || ext === 'markdown') return 'Markdown';
    if (ext === 'puml' || ext === 'pu' || ext === 'plantuml') return 'PlantUML';
    return activeTab.fileExtension?.toUpperCase() || 'Text';
  };

  return (
    <footer className="h-7 w-full flex items-center justify-between px-3 border-t border-border/80 bg-layout-chrome text-[11px] text-muted-foreground select-none shrink-0 z-50">
      {/* Left Side: Git Status, Sync, Workspace */}
      <div className="flex items-center gap-2">
        {workspaceRoot && (
          <>
            {/* Git Branch Details */}
            {branch && (
              <>
                <div 
                  className="flex items-center gap-1 hover:text-foreground hover:bg-muted/50 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                  onClick={() => setBranchSelectorOpen(true)}
                  title="Switch branch / tag"
                >
                  <GitBranch size={13} className="text-primary" />
                  <span className="font-medium text-foreground/80">{branch}</span>
                </div>

                {/* Sync Pull trigger */}
                <button
                  onClick={handleGitSync}
                  disabled={isSyncing}
                  className={cn(
                    "flex items-center gap-1.5 hover:text-foreground hover:bg-muted/50 px-1.5 py-0.5 rounded transition-all cursor-pointer",
                    isSyncing && "opacity-60"
                  )}
                  title="Sync (Git Pull)"
                >
                  <RefreshCw size={11} className={cn("text-muted-foreground", isSyncing && "animate-spin text-primary")} />
                  <span>{syncStatus.behind} ↓ {syncStatus.ahead} ↑</span>
                </button>

                <span className="h-3 w-[1px] bg-border/60" />
              </>
            )}
          </>
        )}
      </div>

      

      {/* Right Side: Cursor Pos, Language */}
      <div className="flex items-center gap-4">
        {/* Cursor Position Coordinates */}
        {cursorPos && (
          <div className="font-mono text-[10px]">
            Ln {cursorPos.line}, Col {cursorPos.col}
          </div>
        )}

        {/* Cursor Tab indication (VS Code-like static tag) */}
        {activeTab && (
          <div className="flex items-center gap-1.5 bg-muted/30 hover:bg-muted/70 px-1.5 py-0.5 rounded font-mono text-[10px]">
            <span>Tab size: 2</span>
          </div>
        )}

        {/* Content Language Indicator */}
        {activeTab && (
          <div className="flex items-center gap-1 hover:text-foreground hover:bg-muted/50 px-1.5 py-0.5 rounded cursor-default transition-colors">
            <FileCode size={12} className="text-primary" />
            <span className="font-semibold text-foreground/80">{getLanguageLabel()}</span>
          </div>
        )}
      </div>
    </footer>
  );
}
