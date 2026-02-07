import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';
import { FlatTreeNode } from './utils';
import { cn } from '@/lib/utils';
import { FileIcon } from '@/components/FileIcon';

interface FileTreeItemProps {
  node: FlatTreeNode;
  isSelected: boolean;
  isActive: boolean;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
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
  const handleClick = () => {
    onSelect(node.path);
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
    <div
      className={cn(
        'group/file-tree-item flex items-center gap-2 px-2 py-1 cursor-pointer select-none text-sm',
        'hover:bg-accent/50 transition-colors text-muted-foreground',
        // isSelected && 'bg-accent text-foreground',
        isActive && 'bg-primary/20 text-foreground'
      )}
      style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
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
            <FolderOpen fill='' className="w-4 h-4 text-blue-500" />
          ) : (
            <Folder fill='' className="w-4 h-4 text-blue-500" />
          )
        ) : (
          <FileIcon filename={node.name} className={`w-4 h-4 group-hover/file-tree-item:grayscale-0 ${isActive ? '' : 'grayscale'}`} />
        )}
      </span>

      {/* Name */}
      <span className="truncate">{node.name}</span>
    </div>
  );
}
