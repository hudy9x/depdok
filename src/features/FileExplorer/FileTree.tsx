import { useAtomValue, useSetAtom } from 'jotai';
import { Virtuoso } from 'react-virtuoso';
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
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const selectedPaths = useAtomValue(selectedPathsAtom);
  /* eslint-enable @typescript-eslint/no-unused-vars */

  const activeTab = useAtomValue(activeTabAtom);
  const toggleFolder = useSetAtom(toggleFolderAtom);
  const selectItem = useSetAtom(selectItemAtom);

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
