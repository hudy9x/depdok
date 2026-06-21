import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useTheme } from 'next-themes';
import '@xterm/xterm/css/xterm.css';

import { useAtomValue, useStore } from 'jotai';
import {
  startPtySession,
  writeToPty,
  resizePty,
  onPtyData,
  onPtyExit,
} from '@/api-client/terminal';
import { activeSplitSessionIdAtom } from '@/stores/TerminalStore';
import type { TerminalTab } from '@/stores/TerminalStore';

// ─── Themes (applied dynamically based on app color scheme) ─────────────────────

const XTERM_DARK_THEME = {
  background: '#0d0d0f',
  foreground: '#cdd6f4',
  cursor: '#89b4fa',
  cursorAccent: '#0d0d0f',
  selectionBackground: '#313244',
  black: '#45475a',
  red: '#f38ba8',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  blue: '#89b4fa',
  magenta: '#cba6f7',
  cyan: '#94e2d5',
  white: '#bac2de',
  brightBlack: '#585b70',
  brightRed: '#f38ba8',
  brightGreen: '#a6e3a1',
  brightYellow: '#f9e2af',
  brightBlue: '#89b4fa',
  brightMagenta: '#cba6f7',
  brightCyan: '#94e2d5',
  brightWhite: '#a6adc8',
};

const XTERM_LIGHT_THEME = {
  background: '#ffffff',
  foreground: '#24292e',
  cursor: '#0969da',
  cursorAccent: '#ffffff',
  selectionBackground: '#add6ff',
  black: '#24292e',
  red: '#cf222e',
  green: '#1a7f37',
  yellow: '#4d2d00',
  blue: '#0969da',
  magenta: '#8250df',
  cyan: '#1b7c83',
  white: '#6e7781',
  brightBlack: '#57606a',
  brightRed: '#a40e26',
  brightGreen: '#116329',
  brightYellow: '#4d2d00',
  brightBlue: '#0550ae',
  brightMagenta: '#6639ba',
  brightCyan: '#055b62',
  brightWhite: '#8c959f',
};

interface TerminalInstanceProps {
  tab: TerminalTab;
  sessionId: string;
  cwd: string;
  workspaceRoot: string | null;
  isActive: boolean;
}

export function TerminalInstance({
  tab,
  sessionId,
  cwd,
  workspaceRoot,
  isActive,
}: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlistenDataRef = useRef<(() => void) | null>(null);
  const unlistenExitRef = useRef<(() => void) | null>(null);
  const cdSentRef = useRef(false);

  const store = useStore();
  const activeSplitId = useAtomValue(activeSplitSessionIdAtom);

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [isExited, setIsExited] = useState(false);
  const [spawnTrigger, setSpawnTrigger] = useState(0);

  // ── Theme updater ───────────────────────────────────────────────────────────
  useEffect(() => {
    const term = termRef.current;
    if (term) {
      term.options.theme = {
        ...(resolvedTheme === 'dark' ? XTERM_DARK_THEME : XTERM_LIGHT_THEME),
        background: 'rgba(0, 0, 0, 0)',
      };
    }
  }, [resolvedTheme]);

  // ── Resize helper (debounced 80 ms) ─────────────────────────────────────────
  const handleResize = useCallback(() => {
    if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    resizeTimerRef.current = setTimeout(() => {
      const fitAddon = fitAddonRef.current;
      const term = termRef.current;
      if (!fitAddon || !term) return;
      try {
        fitAddon.fit();
        resizePty(sessionId, term.cols, term.rows).catch(console.error);
      } catch {
        // FitAddon throws if container has zero dimensions — safe to ignore.
      }
    }, 80);
  }, [sessionId]);

  // ── Restart handler ────────────────────────────────────────────────────────
  const handleRestart = useCallback(() => {
    setIsExited(false);
    cdSentRef.current = false;
    setSpawnTrigger((prev) => prev + 1);
  }, []);

  // ── Mount: initialise xterm + PTY session ───────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily:
        '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, "Consolas", monospace',
      theme: {
        ...(resolvedTheme === 'dark' ? XTERM_DARK_THEME : XTERM_LIGHT_THEME),
        background: 'rgba(0, 0, 0, 0)',
      },
      allowTransparency: true,
      scrollback: 10000,
      convertEol: false,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    if (term.textarea) {
      term.textarea.addEventListener('focus', () => {
        store.set(activeSplitSessionIdAtom, sessionId);
      });
    }

    // Initial fit.
    try {
      fitAddon.fit();
    } catch {
      /* no-op */
    }

    const { cols, rows } = term;

    // Keyboard input → PTY.
    term.onData((data) => {
      writeToPty(sessionId, data).catch(console.error);
    });

    // PTY output → terminal.
    let alive = true;
    onPtyData(sessionId, (data) => {
      if (alive) term.write(data);
    }).then((unlisten) => {
      unlistenDataRef.current = unlisten;
    });

    // PTY exit → status update.
    onPtyExit(sessionId, () => {
      if (alive) {
        setIsExited(true);
        term.write('\r\n\x1b[33m[process exited]\x1b[0m\r\n');
      }
    }).then((unlisten) => {
      unlistenExitRef.current = unlisten;
    });

    // Spawn the backend PTY session.
    startPtySession(sessionId, tab.shellPath, cwd, cols, rows)
      .then(() => {
        // After the shell starts, navigate to workspace root (once per session).
        if (workspaceRoot && !cdSentRef.current) {
          cdSentRef.current = true;
          setTimeout(() => {
            const isCmd = tab.shellPath.toLowerCase().endsWith('cmd.exe');
            const clearCmd = isCmd ? 'cls' : 'clear';
            writeToPty(
              sessionId,
              `cd ${JSON.stringify(workspaceRoot)} && ${clearCmd}\r`,
            ).catch(console.error);
          }, 300);
        }
      })
      .catch((err: unknown) => {
        if (alive) {
          setIsExited(true);
          term.write(
            `\r\n\x1b[31m[Failed to start shell: ${String(err)}]\x1b[0m\r\n`,
          );
        }
      });

    // Observe container resize.
    const observer = new ResizeObserver(handleResize);
    observer.observe(containerRef.current);

    return () => {
      alive = false;
      observer.disconnect();
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      unlistenDataRef.current?.();
      unlistenExitRef.current?.();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, spawnTrigger]);

  // ── Re-fit whenever this tab becomes visible ─────────────────────────────────
  useEffect(() => {
    if (isActive) handleResize();
  }, [isActive, handleResize]);

  // Focus xterm when activeSplitId matches sessionId
  useEffect(() => {
    if (activeSplitId === sessionId && termRef.current) {
      termRef.current.focus();
    }
  }, [activeSplitId, sessionId]);

  return (
    <div
      className="w-full h-full flex flex-col relative"
      style={{ display: isActive ? 'flex' : 'none' }}
    >
      {isExited && (
        <div
          className="flex items-center gap-3 px-4 py-1.5 shrink-0 text-xs border-b"
          style={{
            background: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.04)',
            borderColor: isDark ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.15)',
            color: isDark ? '#fbbf24' : '#d97706',
          }}
        >
          <span>Process exited</span>
          <button
            className="px-2 py-0.5 rounded font-medium transition-colors cursor-pointer"
            style={{
              background: 'rgba(245,158,11,0.18)',
              color: '#fcd34d',
            }}
            onClick={handleRestart}
          >
            Restart
          </button>
        </div>
      )}
      <div ref={containerRef} className="flex-1 min-h-0 p-3" />
    </div>
  );
}

