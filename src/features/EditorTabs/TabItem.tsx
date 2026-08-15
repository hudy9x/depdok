import { useEffect, useRef, useState } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  activeTabIdAtom,
  switchTabAtom,
  closeTabAtom,
  updateTabAtom,
  isDummyPath,
  extractFilenameFromDummyPath,
  type Tab,
} from '@/stores/TabStore';
import {
  activePaneIdAtom,
} from '@/stores/PaneStore';
import { isFileDirtyAtom } from '@/stores/DirtyStore';
import { CloseTabWarning } from './CloseTabWarning';
import { FileIcon } from '@/components/FileIcon';
import { TabContextMenu } from './TabContextMenu';

interface TabItemProps {
  tab: Tab;
  paneId?: string;
  isNextActive?: boolean;
  isFirst?: boolean;
}

export function TabItem({ tab, paneId, isNextActive, isFirst }: TabItemProps) {
  const navigate = useNavigate();
  const activePaneId = useAtomValue(activePaneIdAtom);
  const activeTabId = useAtomValue(activeTabIdAtom);
  const isDirty = useAtomValue(isFileDirtyAtom(tab.filePath));
  const switchTab = useSetAtom(switchTabAtom);
  const closeTab = useSetAtom(closeTabAtom);
  const updateTab = useSetAtom(updateTabAtom);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const tabRef = useRef<HTMLDivElement>(null);

  const isActive = tab.id === activeTabId;

  // Auto-sync: When this tab becomes active (e.g. section/view focused or tab switched), scroll into view
  useEffect(() => {
    if (isActive) {
      tabRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [isActive]);

  const handleClick = () => {
    if (!isActive) {
      // Switch active tab in currently focused pane
      switchTab(tab.id);
    }

    // Navigate to the file path to sync URL
    navigate(`/editor?path=${encodeURIComponent(tab.filePath)}`);
  };

  const handleDoubleClick = () => {
    if (tab.isPreview) {
      updateTab({ tabId: tab.id, updates: { isPreview: false } });
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Show warning if tab has unsaved changes
    if (isDirty) {
      setShowCloseWarning(true);
    } else {
      closeTab(tab.id);
    }
  };

  const handleConfirmClose = (action: 'save' | 'discard' | 'cancel') => {
    setShowCloseWarning(false);

    if (action === 'discard' || action === 'save') {
      closeTab(tab.id);
    }
    // 'cancel' does nothing
  };

  const displayName = isDummyPath(tab.filePath)
    ? extractFilenameFromDummyPath(tab.filePath)
    : (tab.fileName?.split(/[/\\]/).pop() || tab.fileName);

  return (
    <>
      <TabContextMenu tab={tab} paneId={paneId || activePaneId}>
        <div
          ref={tabRef}
          className={cn(
            'depdok-tab flex items-center gap-2 px-3.5 pt-0.5 h-[32px] cursor-pointer group relative',
            'min-w-[120px] max-w-[200px]',
            isActive && 'active',
            isFirst && 'first-tab',
            tab.isPreview && 'italic',
            tab.isDeleted && 'opacity-70'
          )}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          title={tab.isDeleted ? 'File was deleted externally — Save As to recover' : undefined}
        >
          {/* File Icon */}
          <span className="flex-shrink-0 opacity-70">
            <FileIcon filename={displayName} />
          </span>

          <span className={cn(
            'text-xs truncate flex-1 font-normal',
            isActive ? 'font-medium text-foreground' : 'text-muted-foreground group-hover:text-foreground',
            tab.isDeleted && 'line-through text-destructive'
          )}>
            {displayName}
          </span>

          {/* Inactive tab separator (hidden on active, when next tab is active, or on hover) */}
          {!isActive && !isNextActive && (
            <span className="tab-divider absolute right-0 top-1.5 bottom-1.5 w-[1px] bg-border/40 group-hover:opacity-0 pointer-events-none" />
          )}

          {/* Right side interactions: Dirty Indicator + Close Button */}
          <div className="relative w-4 h-4 flex items-center justify-center">
            {/* Dirty Indicator (visible when dirty, hidden on hover to show close button) */}
            {isDirty && (
              <div
                className="w-2 h-2 rounded-full bg-blue-500/80 absolute group-hover:opacity-0"
                title="Unsaved changes"
              />
            )}

            {/* Close Button (visible on hover) */}
            <button
              className={cn(
                "absolute inset-0 flex items-center justify-center rounded hover:bg-muted",
                "opacity-0 group-hover:opacity-100"
              )}
              onClick={handleClose}
              title="Close"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </TabContextMenu>

      {showCloseWarning && (
        <CloseTabWarning
          tab={tab}
          onClose={handleConfirmClose}
        />
      )}
    </>
  );
}
