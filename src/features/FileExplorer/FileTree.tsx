import { useAtomValue, useSetAtom } from 'jotai';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { useRef, useEffect } from 'react';
import { FileTreeItem } from './FileTreeItem';
import {
  flattenedTreeAtom,
  selectedPathsAtom,
  toggleFolderAtom,
  selectItemAtom,
} from './store';
import { activeTabAtom } from '@/stores/TabStore';

interface FileTreeProps {
  onFileOpen: (filePath: string, options?: { isPreview?: boolean }) => void;
}

export function FileTree({ onFileOpen }: FileTreeProps) {
  const flatTree = useAtomValue(flattenedTreeAtom);
  const selectedPaths = useAtomValue(selectedPathsAtom);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const activeTab = useAtomValue(activeTabAtom);
  const toggleFolder = useSetAtom(toggleFolderAtom);
  const selectItem = useSetAtom(selectItemAtom);

  // Scroll to selected file when selection changes
  useEffect(() => {
    if (selectedPaths.size === 1 && virtuosoRef.current) {
      const selectedPath = Array.from(selectedPaths)[0];
      const index = flatTree.findIndex(node => node.path === selectedPath);

      if (index !== -1) {
        // Use a small delay to ensure the tree has been updated
        setTimeout(() => {
          virtuosoRef.current?.scrollToIndex({
            index,
            align: 'center',
            behavior: 'smooth',
          });
        }, 100);
      }
    }
  }, [selectedPaths, flatTree]);

  const handleToggle = (path: string) => {
    toggleFolder(path);
  };

  const handleSelect = (path: string, event?: React.MouseEvent) => {
    const multiSelect = event?.metaKey || event?.ctrlKey; // Command on Mac, Ctrl on Windows
    const rangeSelect = event?.shiftKey;
    selectItem({ path, multiSelect, rangeSelect });

    // Single click on file opens in preview
    // Find node to check if it's a file
    const node = flatTree.find(n => n.path === path);
    if (node && !node.isFolder) {
      onFileOpen(path, { isPreview: true });
    }
  };

  const handleDoubleClick = (path: string) => {
    // Double click on file opens permanently (pins)
    onFileOpen(path, { isPreview: false });
  };

  if (flatTree.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No files to display
      </div>
    );
  }

  return (
    <Virtuoso
      ref={virtuosoRef}
      style={{ height: '100%' }}
      totalCount={flatTree.length}
      itemContent={(index) => {
        const node = flatTree[index];
        return (
          <FileTreeItem
            key={node.id}
            node={node}
            isSelected={selectedPaths.has(node.path)}
            isActive={activeTab?.filePath === node.path}
            onToggle={handleToggle}
            onSelect={handleSelect}
            onDoubleClick={handleDoubleClick}
          />
        );
      }}
    />
  );
}
