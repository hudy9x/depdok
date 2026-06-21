interface TerminalShellBadgeProps {
  isActive: boolean;
  shellPath: string;
  isDark: boolean;
}

function shellBadge(shellPath: string): string {
  const base = shellPath.split(/[/\\]/).pop() ?? shellPath;
  if (base.startsWith('zsh')) return 'zsh';
  if (base.startsWith('bash')) return 'bash';
  if (base.startsWith('fish')) return 'fish';
  if (base.startsWith('pwsh') || base.startsWith('powershell')) return 'ps';
  if (base === 'cmd.exe') return 'cmd';
  return base.slice(0, 4);
}

export function TerminalShellBadge({
  isActive,
  shellPath,
  isDark,
}: TerminalShellBadgeProps) {
  return (
    <span
      className={`shrink-0 font-mono rounded px-1 text-[9px] transition-all duration-150 absolute right-0 ${
        isActive
          ? 'opacity-0 pointer-events-none'
          : 'opacity-100 group-hover:opacity-0 group-hover:pointer-events-none'
      }`}
      style={{
        background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
        color: isDark ? '#9ca3af' : '#4b5563',
      }}
    >
      {shellBadge(shellPath)}
    </span>
  );
}
