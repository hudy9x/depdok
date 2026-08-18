import React, { useState } from 'react';
import { Plus, MoreVertical, Copy, Trash2, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SheetTabBarProps {
  sheetNames: string[];
  activeSheet: string;
  onSelectSheet: (name: string) => void;
  onAddSheet: () => void;
  onRenameSheet: (oldName: string, newName: string) => void;
  onDeleteSheet: (name: string) => void;
  onDuplicateSheet?: (name: string) => void;
}

export const SheetTabBar: React.FC<SheetTabBarProps> = ({
  sheetNames,
  activeSheet,
  onSelectSheet,
  onAddSheet,
  onRenameSheet,
  onDeleteSheet,
  onDuplicateSheet,
}) => {
  const [renamingSheet, setRenamingSheet] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');

  const handleStartRename = (name: string) => {
    setRenamingSheet(name);
    setRenameInput(name);
  };

  const handleFinishRename = (oldName: string) => {
    if (renameInput.trim() && renameInput.trim() !== oldName) {
      onRenameSheet(oldName, renameInput.trim());
    }
    setRenamingSheet(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, oldName: string) => {
    if (e.key === 'Enter') {
      handleFinishRename(oldName);
    } else if (e.key === 'Escape') {
      setRenamingSheet(null);
    }
  };

  return (
    <div className="flex items-center h-8 bg-muted/30 border-t border-border/70 px-2 gap-1 select-none overflow-x-auto text-xs">
      {/* Add Sheet Button */}
      <button
        type="button"
        onClick={onAddSheet}
        title="Add Sheet"
        className="flex items-center justify-center w-6 h-6 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground cursor-pointer transition-colors shrink-0"
      >
        <Plus className="w-4 h-4" />
      </button>

      <div className="h-4 w-px bg-border/80 mx-1 shrink-0" />

      {/* Sheet Tabs List */}
      <div className="flex items-center gap-1 overflow-x-auto py-0.5">
        {sheetNames.map((name) => {
          const isActive = name === activeSheet;
          const isRenaming = renamingSheet === name;

          return (
            <div
              key={name}
              onClick={() => onSelectSheet(name)}
              onDoubleClick={() => handleStartRename(name)}
              className={cn(
                'group flex items-center gap-1.5 px-3 py-1 rounded-t-sm border border-b-0 cursor-pointer text-xs transition-colors shrink-0',
                isActive
                  ? 'bg-background border-border text-foreground font-semibold shadow-xs border-b-2 border-b-primary'
                  : 'bg-muted/40 border-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              )}
            >
              {isRenaming ? (
                <input
                  type="text"
                  autoFocus
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  onBlur={() => handleFinishRename(name)}
                  onKeyDown={(e) => handleKeyDown(e, name)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-20 bg-transparent border-b border-primary outline-none text-xs font-semibold px-0.5"
                />
              ) : (
                <span>{name}</span>
              )}

              {/* Context Dropdown Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100 hover:bg-muted p-0.5 rounded transition-opacity"
                  >
                    <MoreVertical className="w-3 h-3 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-36 text-xs z-[9999]">
                  <DropdownMenuItem onClick={() => handleStartRename(name)}>
                    <Edit3 className="w-3.5 h-3.5 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  {onDuplicateSheet ? (
                    <DropdownMenuItem onClick={() => onDuplicateSheet(name)}>
                      <Copy className="w-3.5 h-3.5 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                  ) : null}
                  {sheetNames.length > 1 ? (
                    <DropdownMenuItem
                      onClick={() => onDeleteSheet(name)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>
    </div>
  );
};
