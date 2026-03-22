import { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { platform } from '@tauri-apps/plugin-os';

import { recentFoldersAtom } from '@/features/FileExplorer/store';
import { updateDockMenu } from '@/api-client/window';

/**
 * Watches recentFoldersAtom and syncs it to the Rust backend so the
 * macOS dock context menu stays up to date.
 * On non-macOS platforms the backend call is a no-op, so this hook is
 * safe to mount unconditionally.
 */
export function useSyncRecentFoldersToDock(): void {
  const recentFolders = useAtomValue(recentFoldersAtom);

  useEffect(() => {
    const os = platform();
    // Only worth syncing on macOS where the dock menu exists
    if (os !== 'macos') return;

    updateDockMenu(recentFolders).catch((err) => {
      console.error('[useSyncRecentFoldersToDock] Failed to update dock menu:', err);
    });
  }, [recentFolders]);
}
