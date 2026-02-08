import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';
import { useAtomValue } from 'jotai';
import { FlatTreeNode } from './utils';
import { cn } from '@/lib/utils';
import { FileIcon } from '@/components/FileIcon';
import { FileContextMenu } from './FileContextMenu';
import { clipboardAtom } from './store';

interface FileTreeItemProps {
  node: FlatTreeNode;
  isSelected: boolean;
  isActive: boolean;
  onToggle: (path: string) => void;
  onSelect: (path: string, event?: React.MouseEvent) => void;
  onDoubleClick: (path: string) => void;
}

export function FileTreeItem({
  node,
  isSelected,
  isActive,
  onToggle,
  onSelect,
  onDoubleClick,
}: FileTreeItemProps) {
  const clipboard = useAtomValue(clipboardAtom);
  const isCut = clipboard?.op === 'cut' && clipboard.paths.includes(node.path);

  const handleClick = (e: React.MouseEvent) => {
    onSelect(node.path, e);
    if (node.isFolder) {
      onToggle(node.path);
    } else {
      onDoubleClick(node.path);
    }
  };

  const handleDoubleClick = () => {
    // Double click handled by single click for files now
    // We could keep it for folders if needed, but toggle is on click
  };

  return (
    <FileContextMenu path={node.path} isFolder={node.isFolder}>
      <div
        data-tauri-drag-region="false"
        className={cn(
          'group/file-tree-item flex items-center gap-2 px-2 py-1 cursor-pointer select-none text-sm transition-colors',
          isSelected
            ? 'bg-accent text-accent-foreground'
            : isActive
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-muted-foreground hover:bg-accent/50',
          isCut && 'opacity-50'
        )}
        style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(_e) => {
          if (!isSelected) {
            onSelect(node.path);
          }
        }}
      >
        {/* Chevron for folders */}
        {node.isFolder ? (
          <span className="flex-shrink-0 w-4 h-4">
            {node.isOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </span>
        ) : (
          <span className="flex-shrink-0 w-4 h-4" />
        )}

        {/* Icon */}
        <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
          {node.isFolder ? (
            node.isOpen ? (
              <FolderOpen fill='var(--accent)' className="w-4 h-4 text-primary" />
            ) : (
              <Folder fill='var(--primary)' className="w-4 h-4 text-primary" />
            )
          ) : (
            <FileIcon filename={node.name} className={`w-4 h-4 group-hover/file-tree-item:grayscale-0 ${isActive || isSelected ? '' : 'grayscale'}`} />
          )}
        </span>

        {/* Name */}
        <span className="truncate">{node.name}</span>
      </div>
    </FileContextMenu >
  );
}
