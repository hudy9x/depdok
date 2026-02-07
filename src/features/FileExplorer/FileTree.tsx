import { useAtomValue, useSetAtom } from 'jotai';
import { Virtuoso } from 'react-virtuoso';
import { FileTreeItem } from './FileTreeItem';
import {
  flattenedTreeAtom,
  selectedItemAtom,
  toggleFolderAtom,
  selectItemAtom,
} from './store';
import { activeTabAtom } from '@/stores/TabStore';

interface FileTreeProps {
  onFileOpen: (filePath: string) => void;
}

export function FileTree({ onFileOpen }: FileTreeProps) {
  const flatTree = useAtomValue(flattenedTreeAtom);
  const selectedItem = useAtomValue(selectedItemAtom);
  const activeTab = useAtomValue(activeTabAtom);
  const toggleFolder = useSetAtom(toggleFolderAtom);
  const selectItem = useSetAtom(selectItemAtom);

  const handleToggle = (path: string) => {
    toggleFolder(path);
  };

  const handleSelect = (path: string) => {
    selectItem(path);
  };

  const handleDoubleClick = (path: string) => {
    onFileOpen(path);
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
            isSelected={selectedItem === node.path}
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
