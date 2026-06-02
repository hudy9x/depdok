import { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { GitBranch, RefreshCw, FileCode, CheckCircle, Terminal } from 'lucide-react';
import { toast } from 'sonner';

import { workspaceRootAtom } from '@/features/FileExplorer/store';
import { activeTabAtom } from '@/stores/TabStore';
import { getCurrentBranch, gitPull } from '@/lib/gitUtils';
import { cn } from '@/lib/utils';

export function Footer() {
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const activeTab = useAtomValue(activeTabAtom);

  const [branch, setBranch] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number } | null>(null);

  // 1. Fetch current Git branch if workspace root changes
  useEffect(() => {
    const fetchBranch = async () => {
      if (workspaceRoot) {
        const current = await getCurrentBranch(workspaceRoot);
        setBranch(current || 'main');
      } else {
        setBranch('');
      }
    };

    fetchBranch();

    // Check periodically (every 10s)
    const interval = setInterval(fetchBranch, 10000);
    return () => clearInterval(interval);
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
        // Refresh branch just in case
        const current = await getCurrentBranch(workspaceRoot);
        setBranch(current || 'main');
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
      <div className="flex items-center gap-4">
        {workspaceRoot && (
          <>
            {/* Git Branch Details */}
            <div 
              className="flex items-center gap-1 hover:text-foreground hover:bg-muted/50 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
              onClick={handleGitSync}
              title="Git sync / Switch branch"
            >
              <GitBranch size={13} className="text-primary" />
              <span className="font-medium text-foreground/80">{branch || 'detached'}</span>
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
              <span>0 ↓ 11 ↑</span>
            </button>

            <span className="h-3 w-[1px] bg-border/60" />

            {/* Workspace Name */}
            <div className="flex items-center gap-1" title={workspaceRoot}>
              <Terminal size={12} className="text-muted-foreground/80" />
              <span className="truncate max-w-[120px] font-semibold text-foreground/65">
                {getWorkspaceName()}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Middle Section: System Status alerts */}
      <div className="flex items-center gap-3">
        {workspaceRoot && (
          <div className="flex items-center gap-1.5 hover:text-foreground px-1 py-0.5 rounded cursor-help" title="0 warnings, 0 errors">
            <CheckCircle size={12} className="text-green-500" />
            <span className="text-[10px] text-green-500/80 font-medium">Synced</span>
          </div>
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
