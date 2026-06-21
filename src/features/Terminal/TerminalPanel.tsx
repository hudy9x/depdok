import { useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useTheme } from 'next-themes';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { workspaceRootAtom } from '@/features/FileExplorer/store';
import {
  terminalTabsAtom,
  activeTerminalTabIdAtom,
  terminalHeightAtom,
  terminalWidthAtom,
  isTerminalOpenAtom,
  setIsTerminalOpenAtom,
  setActiveTerminalTabIdAtom,
  addTerminalTabAtom,
  removeTerminalTabAtom,
  renameTerminalTabAtom,
  terminalPositionAtom,
  setTerminalPositionAtom,
  splitTerminalTabAtom,
} from '@/stores/TerminalStore';
import type { TerminalTab } from '@/stores/TerminalStore';

import { closePtySession } from '@/api-client/terminal';
import { TerminalHeader } from './TerminalHeader';
import { TerminalViewport } from './TerminalViewport';
import { TerminalTabList } from './TerminalTabList';
import { useTerminalResize } from './useTerminalResize';

// ─── Shell discovery ────────────────────────────────────────────────────────────

async function discoverShells(): Promise<string[]> {
  const isWindows = navigator.userAgent.includes('Windows');

  if (!isWindows) {
    try {
      const { readFileContent } = await import('@/lib/fileOperations');
      const raw = await readFileContent('/etc/shells');
      const shells = raw
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'));
      if (shells.length > 0) return shells;
    } catch {
      // fall through to defaults
    }
    return ['/bin/zsh', '/bin/bash', '/bin/sh'];
  }

  return ['powershell.exe', 'cmd.exe', 'C:\\Program Files\\Git\\bin\\bash.exe'];
}

function getDefaultShell(): string {
  return navigator.userAgent.includes('Windows') ? 'powershell.exe' : '/bin/zsh';
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface TerminalPanelProps {
  shortcutHint?: string;
}

export function TerminalPanel({ shortcutHint = 'Ctrl+`' }: TerminalPanelProps) {
  const isOpen = useAtomValue(isTerminalOpenAtom);
  const setIsOpen = useSetAtom(setIsTerminalOpenAtom);
  const tabs = useAtomValue(terminalTabsAtom);
  const activeTabId = useAtomValue(activeTerminalTabIdAtom);
  const setActiveTabId = useSetAtom(setActiveTerminalTabIdAtom);
  const panelHeight = useAtomValue(terminalHeightAtom);
  const panelWidth = useAtomValue(terminalWidthAtom);
  const terminalPosition = useAtomValue(terminalPositionAtom);
  const setTerminalPosition = useSetAtom(setTerminalPositionAtom);
  const addTab = useSetAtom(addTerminalTabAtom);
  const removeTab = useSetAtom(removeTerminalTabAtom);
  const renameTab = useSetAtom(renameTerminalTabAtom);
  const splitTab = useSetAtom(splitTerminalTabAtom);
  const workspaceRoot = useAtomValue(workspaceRootAtom);

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [shells, setShells] = useState<string[]>([]);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Discover available shells once on mount.
  useEffect(() => {
    discoverShells().then(setShells);
  }, []);

  // Determine working directory
  const cwd =
    workspaceRoot ??
    (navigator.userAgent.includes('Windows')
      ? 'C:\\Users'
      : typeof process !== 'undefined'
        ? (process.env?.HOME ?? '/')
        : '/');

  // Add new tab
  const handleAddTab = useCallback(
    (shellPath = getDefaultShell()) => {
      const id = crypto.randomUUID();
      const name = `Shell ${tabs.length + 1}`;
      const newTab: TerminalTab = { id, name, shellPath, status: 'running', splitIds: [id] };
      addTab(newTab);
    },
    [addTab, tabs.length],
  );

  // Split tab view side-by-side
  const handleSplitTab = useCallback(
    (tabId: string) => {
      splitTab(tabId);
    },
    [splitTab],
  );

  // Initialize first tab automatically if empty
  const hasInitialised = useRef(false);
  useEffect(() => {
    if (!hasInitialised.current && tabs.length === 0) {
      hasInitialised.current = true;
      handleAddTab();
    } else {
      hasInitialised.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remove tab session
  const handleRemoveTab = useCallback(
    (e: React.MouseEvent, tab: TerminalTab) => {
      e.stopPropagation();
      const sessions = tab.splitIds && tab.splitIds.length > 0 ? tab.splitIds : [tab.id];
      sessions.forEach((sid) => {
        closePtySession(sid).catch(console.error);
      });
      removeTab(tab.id);
    },
    [removeTab],
  );

  // Rename actions
  const handleTabDoubleClick = useCallback((tab: TerminalTab) => {
    setEditingTabId(tab.id);
    setEditingName(tab.name);
  }, []);

  const handleRenameSubmit = useCallback(() => {
    if (editingTabId && editingName.trim()) {
      renameTab({ tabId: editingTabId, name: editingName.trim() });
    }
    setEditingTabId(null);
  }, [editingTabId, editingName, renameTab]);

  // Hook for drag resize
  const { handleDragStart } = useTerminalResize();

  const isRight = terminalPosition === 'right';

  return (
    <div
      className={`flex flex-col shrink-0 relative transition-all duration-150 bg-layout-chrome ${
        isRight
          ? 'h-full border-l border-border'
          : 'w-full border-t border-border'
      }`}
      style={{
        height: isRight ? '100%' : (isOpen ? panelHeight : 0),
        width: isRight ? (isOpen ? panelWidth : 0) : '100%',
        overflow: 'hidden',
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
    >
      {/* Drag handle */}
      {isOpen && (
        isRight ? (
          <div
            className="absolute top-0 bottom-0 left-0 w-1.5 z-20 cursor-ew-resize hover:bg-primary/40 transition-colors"
            style={{ background: 'transparent' }}
            onMouseDown={handleDragStart}
          />
        ) : (
          <div
            className="absolute top-0 left-0 right-0 h-1.5 z-20 cursor-ns-resize hover:bg-primary/40 transition-colors"
            style={{ background: 'transparent' }}
            onMouseDown={handleDragStart}
          />
        )
      )}

      {/* Header */}
      {isOpen && (
        <TerminalHeader
          isRight={isRight}
          shells={shells}
          handleAddTab={handleAddTab}
          setTerminalPosition={setTerminalPosition}
          setIsOpen={setIsOpen}
          shortcutHint={shortcutHint}
        />
      )}

      {/* Main split: viewport (left) + tabs (right) */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Terminal viewport */}
        <div className="flex-1 min-w-0 relative">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className="absolute inset-0 flex flex-col"
              style={{ display: tab.id === activeTabId ? 'flex' : 'none' }}
            >
              <TerminalViewport
                tab={tab}
                cwd={cwd}
                workspaceRoot={workspaceRoot}
                isActive={isOpen && tab.id === activeTabId}
                handleAddTab={() => handleAddTab()}
              />
            </div>
          ))}

          {tabs.length === 0 && (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => handleAddTab()}
              >
                <Plus size={13} />
                New terminal
              </Button>
            </div>
          )}
        </div>

        {/* Tab strip */}
        <TerminalTabList
          tabs={tabs}
          activeTabId={activeTabId}
          isRight={isRight}
          isDark={isDark}
          editingTabId={editingTabId}
          editingName={editingName}
          setEditingName={setEditingName}
          onRenameSubmit={handleRenameSubmit}
          onRenameCancel={() => setEditingTabId(null)}
          onTabDoubleClick={handleTabDoubleClick}
          onTabSelect={setActiveTabId}
          onTabRemove={handleRemoveTab}
          onTabSplit={handleSplitTab}
        />
      </div>
    </div>
  );
}
