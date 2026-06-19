import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetAtom } from 'jotai';
import { toast } from 'sonner';

import { getPendingOpenPaths } from '@/api-client/cli';
import { createTabAtom } from '@/stores/TabStore';
import { openWorkspaceAtom } from '@/features/FileExplorer/store';

const Checking = (): JSX.Element => {
  const navigate = useNavigate();
  const createTab = useSetAtom(createTabAtom);
  const openWorkspace = useSetAtom(openWorkspaceAtom);

  useEffect(() => {
    const checkInitialPathsAndRedirect = async (): Promise<void> => {
      try {
        const pendingPaths = await getPendingOpenPaths();
        if (pendingPaths && pendingPaths.length > 0) {
          let hasOpenedWorkspace = false;
          let firstOpenedTabId: string | null = null;
          const missingPaths: string[] = [];

          for (const item of pendingPaths) {
            if (!item.exists) {
              missingPaths.push(item.path);
              continue;
            }

            if (item.is_dir) {
              try {
                await openWorkspace(item.path);
                hasOpenedWorkspace = true;
              } catch (err) {
                console.error('Failed to open workspace:', item.path, err);
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
            toast.error(`Some files do not exist:\n${missingPaths.join('\n')}`);
          }

          if (hasOpenedWorkspace || firstOpenedTabId) {
            navigate('/editor', { replace: true });
            return;
          }
        }
      } catch (error) {
        console.error('Error checking pending open paths:', error);
      }

      // Fallback: Check sessionStorage for saved tabs
      const savedTabs = sessionStorage.getItem('depdok-tabs');
      if (savedTabs) {
        try {
          const tabs = JSON.parse(savedTabs);
          if (Array.isArray(tabs) && tabs.length > 0) {
            navigate('/editor', { replace: true });
            return;
          }
        } catch (error) {
          console.error('Error parsing saved tabs:', error);
        }
      }

      navigate('/home', { replace: true });
    };

    checkInitialPathsAndRedirect();
  }, [navigate, createTab, openWorkspace]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-secondary">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
};

export default Checking;
