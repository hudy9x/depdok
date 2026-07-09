import { useEffect, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { GitBranch, Pencil, Plus, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';

import { onWorkspaceChanged } from '@/lib/fileWatcher';
import { getCurrentBranch, getGitStatus, gitPull, getGitSyncStatus, hasGitUpstream, isGitRepository, onGitChanged, startWatchingGit, stopWatchingGit, summarizeGitStatus } from '@/lib/gitUtils';
import { cn } from '@/lib/utils';

import { branchSelectorOpenAtom } from '@/features/BranchSelector/store';
import { workspaceRootAtom } from '@/features/FileExplorer/store';
import { gitStatusAtom } from '@/stores/GitStore';

const EMPTY_SYNC_STATUS = { ahead: 0, behind: 0 };
const EMPTY_WORKING_TREE_STATUS = { changed: 0, new: 0, deleted: 0 };

export function FooterGitSection() {
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const setBranchSelectorOpen = useSetAtom(branchSelectorOpenAtom);
  const setGitStatus = useSetAtom(gitStatusAtom);

  const [branch, setBranch] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<{ ahead: number; behind: number }>(EMPTY_SYNC_STATUS);
  const [workingTreeStatus, setWorkingTreeStatus] = useState<{ changed: number; new: number; deleted: number }>(EMPTY_WORKING_TREE_STATUS);
  const [hasUpstream, setHasUpstream] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    let unlistenGit: (() => void) | null = null;
    let unlistenWorkspace: (() => void) | null = null;
    let isSubscribed = true;

    const fetchGitInfo = async (isGit: boolean) => {
      if (!isGit) {
        if (isSubscribed) {
          setBranch('');
          setSyncStatus(EMPTY_SYNC_STATUS);
          setWorkingTreeStatus(EMPTY_WORKING_TREE_STATUS);
          setHasUpstream(false);
          setGitStatus({});
        }
        return;
      }

      if (workspaceRoot) {
        try {
          const [currentBranch, gitStatus, upstreamConfigured] = await Promise.all([
            getCurrentBranch(workspaceRoot),
            getGitStatus(workspaceRoot),
            hasGitUpstream(workspaceRoot),
          ]);

          if (!isSubscribed) return;

          const status = upstreamConfigured
            ? await getGitSyncStatus(workspaceRoot)
            : EMPTY_SYNC_STATUS;

          if (!isSubscribed) return;

          const isDirty = Object.keys(gitStatus).length > 0;
          const displayBranch = currentBranch ? (isDirty ? `${currentBranch}*` : currentBranch) : 'main';

          setBranch(displayBranch);
          setSyncStatus(status || EMPTY_SYNC_STATUS);
          setWorkingTreeStatus(summarizeGitStatus(gitStatus));
          setHasUpstream(upstreamConfigured);
          setGitStatus(gitStatus);
        } catch (error) {
          console.error('Failed to fetch Git info:', error);
        }
      }
    };

    const initGit = async () => {
      if (!workspaceRoot) {
        if (isSubscribed) {
          setBranch('');
          setSyncStatus(EMPTY_SYNC_STATUS);
          setWorkingTreeStatus(EMPTY_WORKING_TREE_STATUS);
          setHasUpstream(false);
          setGitStatus({});
        }
        return;
      }

      try {
        const isGit = await isGitRepository(workspaceRoot);
        if (!isSubscribed) return;

        if (isGit) {
          await startWatchingGit(workspaceRoot);
          if (!isSubscribed) return;

          unlistenGit = await onGitChanged(() => {
            fetchGitInfo(true);
          });

          unlistenWorkspace = await onWorkspaceChanged(() => {
            fetchGitInfo(true);
          });
        }

        await fetchGitInfo(isGit);
      } catch (error) {
        console.error('Failed to initialize Git status:', error);
      }
    };

    initGit();

    return () => {
      isSubscribed = false;
      if (unlistenGit) unlistenGit();
      if (unlistenWorkspace) unlistenWorkspace();
      stopWatchingGit();
    };
  }, [workspaceRoot]);

  const handleGitSync = async () => {
    if (!workspaceRoot) {
      toast.info('No active workspace open');
      return;
    }

    if (!hasUpstream) {
      toast.error('Current branch has no upstream tracking branch configured');
      return;
    }

    setIsSyncing(true);
    const toastId = toast.loading('Performing Git sync pull...');

    try {
      const result = await gitPull(workspaceRoot);
      if (result.success) {
        toast.success('Git pull sync complete', { id: toastId });

        const [current, gitStatus, upstreamConfigured] = await Promise.all([
          getCurrentBranch(workspaceRoot),
          getGitStatus(workspaceRoot),
          hasGitUpstream(workspaceRoot),
        ]);

        const status = upstreamConfigured
          ? await getGitSyncStatus(workspaceRoot)
          : EMPTY_SYNC_STATUS;

        const isDirty = Object.keys(gitStatus).length > 0;
        const displayBranch = current ? (isDirty ? `${current}*` : current) : 'main';

        setBranch(displayBranch);
        setSyncStatus(status || EMPTY_SYNC_STATUS);
        setWorkingTreeStatus(summarizeGitStatus(gitStatus));
        setHasUpstream(upstreamConfigured);
        setGitStatus(gitStatus);
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

  if (!workspaceRoot || !branch) {
    return null;
  }

  return (
    <>
      <div
        className="flex items-center gap-1 hover:text-foreground hover:bg-muted/50 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
        onClick={() => setBranchSelectorOpen(true)}
        title="Switch branch / tag"
      >
        <GitBranch size={13} className="text-primary" />
        <span className="font-medium text-foreground/80">{branch}</span>
      </div>

      <button
        onClick={handleGitSync}
        disabled={isSyncing || !hasUpstream}
        className={cn(
          'flex items-center gap-1.5 hover:text-foreground hover:bg-muted/50 px-1.5 py-0.5 rounded transition-all cursor-pointer',
          (isSyncing || !hasUpstream) && 'opacity-60'
        )}
        title={hasUpstream ? 'Sync (Git Pull)' : 'Current branch has no upstream tracking branch'}
      >
        <RefreshCw size={11} className={cn('text-muted-foreground', isSyncing && 'animate-spin text-primary')} />
        <span>{hasUpstream ? `${syncStatus.behind} ↓ ${syncStatus.ahead} ↑` : 'No upstream'}</span>
      </button>

      {(workingTreeStatus.changed > 0 || workingTreeStatus.new > 0 || workingTreeStatus.deleted > 0) && (
        <div
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-foreground/75"
          title={`Working tree status: ${workingTreeStatus.changed} changed, ${workingTreeStatus.new} new, ${workingTreeStatus.deleted} deleted`}
        >
          {workingTreeStatus.changed > 0 && (
            <div className="flex items-center gap-1 px-0.5 text-amber-900 dark:text-amber-500">
              <Pencil size={10} />
              <span>{workingTreeStatus.changed}</span>
            </div>
          )}
          {workingTreeStatus.new > 0 && (
            <div className="flex items-center gap-1 px-0.5 text-emerald-600 dark:text-emerald-400">
              <Plus size={10} />
              <span>{workingTreeStatus.new}</span>
            </div>
          )}
          {workingTreeStatus.deleted > 0 && (
            <div className="flex items-center gap-1 px-0.5 text-rose-600 dark:text-rose-400">
              <X size={10} />
              <span>{workingTreeStatus.deleted}</span>
            </div>
          )}
        </div>
      )}

      <span className="h-3 w-[1px] bg-border/60" />
    </>
  );
}