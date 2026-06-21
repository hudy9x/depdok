import { AtSign, Columns, Trash2 } from 'lucide-react';

interface TerminalTabActionsProps {
  onRenameClick: (e: React.MouseEvent) => void;
  onSplitClick: (e: React.MouseEvent) => void;
  onRemoveClick: (e: React.MouseEvent) => void;
}

export function TerminalTabActions({
  onRenameClick,
  onSplitClick,
  onRemoveClick,
}: TerminalTabActionsProps) {
  return (
    <div
      className="flex items-center gap-0.5 transition-all duration-150 absolute right-0 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto bg-transparent z-10"
    >
      <button
        type="button"
        title="Rename terminal"
        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        onClick={onRenameClick}
      >
        <AtSign size={12} />
      </button>

      <button
        type="button"
        title="Split terminal"
        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        onClick={onSplitClick}
      >
        <Columns size={12} />
      </button>

      <button
        type="button"
        title="Kill terminal"
        className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-red-500 transition-colors cursor-pointer"
        onClick={onRemoveClick}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}
