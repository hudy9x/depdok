import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { isFileExplorerVisibleAtom } from '@/features/FileExplorer/store';

export function useGlobalShortcuts() {
  const [isFileExplorerVisible, setIsFileExplorerVisible] = useAtom(isFileExplorerVisibleAtom);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + B to toggle File Explorer
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsFileExplorerVisible((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setIsFileExplorerVisible]);
}
