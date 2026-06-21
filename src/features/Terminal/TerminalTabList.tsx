import React, { useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { X, SquareTerminal } from 'lucide-react';
import type { TerminalTab } from '@/stores/TerminalStore';
import {
  activeSplitSessionIdAtom,
  closeSplitSessionAtom,
} from '@/stores/TerminalStore';
import { closePtySession } from '@/api-client/terminal';
import { TerminalTabItem } from './TerminalTabItem';

interface TerminalTabListProps {
  tabs: TerminalTab[];
  activeTabId: string | null;
  isRight: boolean;
  isDark: boolean;
  editingTabId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onTabDoubleClick: (tab: TerminalTab) => void;
  onTabSelect: (tabId: string) => void;
  onTabRemove: (e: React.MouseEvent, tab: TerminalTab) => void;
  onTabSplit: (tabId: string) => void;
}

interface TerminalSplitItemProps {
  tabId: string;
  sessionId: string;
  connector: string;
  isActive: boolean;
  isDark: boolean;
  shellPath: string;
  onSelect: () => void;
  onRemove: (e: React.MouseEvent) => void;
}

function TerminalSplitItem({
  connector,
  isActive,
  isDark,
  shellPath,
  onSelect,
  onRemove,
}: TerminalSplitItemProps) {
  const shellName = shellPath.split(/[/\\]/).pop() ?? 'shell';

  return (
    <button
      onClick={onSelect}
      className="group flex items-center gap-1 w-full py-0.5 pr-1.5 rounded text-left transition-all relative hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-mono text-[11px]"
      style={{
        background: isActive
          ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')
          : 'transparent',
        color: isActive
          ? (isDark ? '#e5e7eb' : '#1f2937')
          : (isDark ? '#9ca3af' : '#4b5563'),
      }}
    >
      {/* Connector branch */}
      <span className="text-zinc-500/50 font-sans tracking-tight shrink-0 select-none pl-1 text-xs">
        {connector}
      </span>

      {/* Small terminal icon */}
      <SquareTerminal size={10} className="shrink-0 text-zinc-500" />

      {/* Shell basename */}
      <span className="truncate flex-1 font-sans text-[11px] font-medium leading-none">
        {shellName}
      </span>

      {/* Kill split button */}
      <button
        type="button"
        title="Kill split terminal"
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500 hover:text-white transition-all cursor-pointer shrink-0 z-10"
        onClick={onRemove}
      >
        <X size={10} />
      </button>
    </button>
  );
}

export function TerminalTabList({
  tabs,
  activeTabId,
  isRight,
  isDark,
  editingTabId,
  editingName,
  setEditingName,
  onRenameSubmit,
  onRenameCancel,
  onTabDoubleClick,
  onTabSelect,
  onTabRemove,
  onTabSplit,
}: TerminalTabListProps) {
  const activeSplitId = useAtomValue(activeSplitSessionIdAtom);
  const setActiveSplitId = useSetAtom(activeSplitSessionIdAtom);
  const closeSplit = useSetAtom(closeSplitSessionAtom);

  const handleSplitRemove = useCallback(
    (e: React.MouseEvent, tabId: string, sessionId: string) => {
      e.stopPropagation();
      closePtySession(sessionId).catch(console.error);
      closeSplit({ tabId, subSessionId: sessionId });
    },
    [closeSplit],
  );

  return (
    <div
      className="flex flex-col items-stretch shrink-0 overflow-y-auto border-l border-border bg-layout-chrome/60"
      style={{
        width: isRight ? 48 : 168,
      }}
    >
      <div className={`flex flex-col p-1 flex-1 ${isRight ? 'gap-2 items-center' : 'gap-px'}`}>
        {tabs.map((tab) => {
          const isTabActive = tab.id === activeTabId;
          const splits = tab.splitIds && tab.splitIds.length > 0 ? tab.splitIds : [tab.id];

          return (
            <div key={tab.id} className="flex flex-col w-full">
              {/* Main Tab Item */}
              <TerminalTabItem
                tab={tab}
                isActive={isTabActive}
                isRight={isRight}
                isDark={isDark}
                editingTabId={editingTabId}
                editingName={editingName}
                setEditingName={setEditingName}
                onRenameSubmit={onRenameSubmit}
                onRenameCancel={onRenameCancel}
                onDoubleClick={() => onTabDoubleClick(tab)}
                onSelect={() => onTabSelect(tab.id)}
                onRemove={(e) => onTabRemove(e, tab)}
                onSplit={() => onTabSplit(tab.id)}
              />

              {/* Splits child nodes */}
              {!isRight && splits.length > 1 && (
                <div className="flex flex-col pl-4 mt-0.5 mb-1.5 gap-px">
                  {splits.map((sid, idx) => {
                    const isSplitActive = activeSplitId === sid;
                    const isLast = idx === splits.length - 1;
                    const isFirst = idx === 0;
                    const connector = isFirst ? '┌─' : isLast ? '└─' : '├─';

                    return (
                      <TerminalSplitItem
                        key={sid}
                        tabId={tab.id}
                        sessionId={sid}
                        connector={connector}
                        isActive={isSplitActive}
                        isDark={isDark}
                        shellPath={tab.shellPath}
                        onSelect={() => {
                          onTabSelect(tab.id);
                          setActiveSplitId(sid);
                        }}
                        onRemove={(e) => handleSplitRemove(e, tab.id, sid)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
