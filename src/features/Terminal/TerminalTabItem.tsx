import { SquareTerminal, X } from 'lucide-react';
import type { TerminalTab } from '@/stores/TerminalStore';
import { TerminalTabActions } from './TerminalTabActions';
import { TerminalShellBadge } from './TerminalShellBadge';

interface TerminalTabItemProps {
  tab: TerminalTab;
  isActive: boolean;
  isRight: boolean;
  isDark: boolean;
  editingTabId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onDoubleClick: () => void;
  onSelect: () => void;
  onRemove: (e: React.MouseEvent) => void;
  onSplit: () => void;
}

export function TerminalTabItem({
  tab,
  isActive,
  isRight,
  isDark,
  editingTabId,
  editingName,
  setEditingName,
  onRenameSubmit,
  onRenameCancel,
  onDoubleClick,
  onSelect,
  onRemove,
  onSplit,
}: TerminalTabItemProps) {
  if (isRight) {
    return (
      <button
        id={`terminal-tab-${tab.id}`}
        onClick={onSelect}
        onDoubleClick={onDoubleClick}
        title={tab.name}
        className="group flex items-center justify-center w-9 h-9 rounded-md transition-colors relative hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
        style={{
          background: isActive
            ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)')
            : 'transparent',
          color: isActive
            ? (isDark ? '#e5e7eb' : '#1f2937')
            : (isDark ? '#8a8d90' : '#6b7280'),
        }}
      >
        {/* Active indicator bar */}
        {isActive && (
          <span
            className="absolute left-0 top-2 bottom-2 rounded-r"
            style={{ width: 2, background: '#6366f1' }}
          />
        )}

        <SquareTerminal
          size={14}
          style={{
            flexShrink: 0,
            color:
              tab.status === 'exited'
                ? '#fbbf24'
                : tab.status === 'error'
                  ? '#f87171'
                  : isActive
                    ? (isDark ? '#ffffff' : '#000000')
                    : (isDark ? '#9ca3af' : '#4b5563'),
          }}
        />

        {/* Close button — visible on hover */}
        <span
          role="button"
          aria-label={`Close ${tab.name}`}
          tabIndex={0}
          className="absolute top-0.5 right-0.5 rounded-full p-0.5 opacity-0 group-hover:opacity-80 hover:!opacity-100 hover:bg-red-500 hover:text-white transition-all bg-black/60 dark:bg-black/60 text-white/80"
          onClick={onRemove}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRemove(e as unknown as React.MouseEvent);
          }}
        >
          <X size={8} />
        </span>
      </button>
    );
  }

  return (
    <button
      id={`terminal-tab-${tab.id}`}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      title={tab.name}
      className="group flex items-center gap-2 w-full px-2.5 text-left transition-all relative hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer animate-in fade-in-50 duration-150"
      style={{
        background: isActive
          ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)')
          : 'transparent',
        color: isActive
          ? (isDark ? '#e5e7eb' : '#1f2937')
          : (isDark ? '#8a8d90' : '#6b7280'),
        fontSize: 12,
      }}
    >
      <SquareTerminal
        size={14}
        style={{
          flexShrink: 0,
          color:
            tab.status === 'exited'
              ? '#fbbf24'
              : tab.status === 'error'
                ? '#f87171'
                : isActive
                  ? (isDark ? '#ffffff' : '#000000')
                  : (isDark ? '#9ca3af' : '#4b5563'),
        }}
      />

      {editingTabId === tab.id ? (
        <input
          autoFocus
          className="flex-1 min-w-0 bg-transparent border-none outline-none font-normal"
          style={{ fontSize: 12, color: isDark ? '#e5e7eb' : '#1f2937' }}
          value={editingName}
          onChange={(e) => setEditingName(e.target.value)}
          onBlur={onRenameSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRenameSubmit();
            if (e.key === 'Escape') onRenameCancel();
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className={`flex-1 min-w-0 truncate text-xs ${isActive
            ? 'text-foreground font-medium'
            : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          {tab.name}
        </span>
      )}

      {/* Actions / Badge Wrapper */}
      <div className="relative flex items-center justify-end w-16 h-5 ml-auto">
        <TerminalTabActions
          onRenameClick={(e) => {
            e.stopPropagation();
            onDoubleClick();
          }}
          onSplitClick={(e) => {
            e.stopPropagation();
            onSplit();
          }}
          onRemoveClick={onRemove}
        />

        <TerminalShellBadge
          isActive={isActive}
          shellPath={tab.shellPath}
          isDark={isDark}
        />
      </div>
    </button>
  );
}
