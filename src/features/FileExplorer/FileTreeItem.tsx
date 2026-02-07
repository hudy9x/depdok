import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react';
import { FlatTreeNode } from './utils';
import { cn } from '@/lib/utils';

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
    }
  };

  const handleDoubleClick = () => {
    if (!node.isFolder) {
      onDoubleClick(node.path);
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-2 py-1 cursor-pointer select-none text-sm',
        'hover:bg-accent/50 transition-colors',
        isSelected && 'bg-accent',
        isActive && 'bg-primary/10'
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
      <span className="flex-shrink-0 w-4 h-4">
        {node.isFolder ? (
          node.isOpen ? (
            <FolderOpen className="w-4 h-4 text-blue-500" />
          ) : (
            <Folder className="w-4 h-4 text-blue-500" />
          )
        ) : (
          <File className="w-4 h-4 text-muted-foreground" />
        )}
      </span>

      {/* Name */}
      <span className="truncate">{node.name}</span>
    </div>
  );
}
