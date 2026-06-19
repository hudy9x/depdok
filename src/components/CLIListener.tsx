import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetAtom } from 'jotai';
import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';

import { PendingPath } from '@/api-client/cli';
import { createTabAtom } from '@/stores/TabStore';
import { openWorkspaceAtom } from '@/features/FileExplorer/store';

export const CLIListener = (): null => {
  const createTab = useSetAtom(createTabAtom);
  const openWorkspace = useSetAtom(openWorkspaceAtom);
  const navigate = useNavigate();

  useEffect(() => {
    const handlePaths = async (paths: PendingPath[]): Promise<void> => {
      if (!paths || paths.length === 0) return;

      let hasOpenedWorkspace = false;
      let firstOpenedTabId: string | null = null;
      const missingPaths: string[] = [];

      for (const item of paths) {
        if (!item.exists) {
          missingPaths.push(item.path);
          continue;
        }

        if (item.is_dir) {
          try {
            await openWorkspace(item.path);
            hasOpenedWorkspace = true;
          } catch (err) {
            console.error('Failed to open workspace path:', item.path, err);
            toast.error(`Failed to open directory: ${item.path}`);
          }
        } else {
          const parts = item.path.split(/[/\\]/);
          const fileName = parts[parts.length - 1] || 'Untitled';
          const isFirstFile = firstOpenedTabId === null;
          
          const tabId = createTab({
            filePath: item.path,
            fileName,
            switchTo: isFirstFile,
          });

          if (isFirstFile) {
            firstOpenedTabId = tabId;
          }
        }
      }

      if (missingPaths.length > 0) {
        toast.error(`Some paths do not exist:\n${missingPaths.join('\n')}`);
      }

      if (hasOpenedWorkspace || firstOpenedTabId) {
        navigate('/editor');
      }
    };

    let unlistenFn: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const unlisten = await listen<PendingPath[]>('open-paths', (event) => {
          console.log('[CLIListener] open-paths event:', event.payload);
          handlePaths(event.payload);
        });
        unlistenFn = unlisten;
      } catch (err) {
        console.error('[CLIListener] Failed to setup open-paths listener:', err);
      }
    };

    setupListener();

    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [createTab, openWorkspace, navigate]);

  return null;
};
