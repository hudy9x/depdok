import { useEffect, useRef, useState } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  paneActiveTabIdAtomFamily,
  switchTabAtom,
  closeTabAtom,
  updateTabAtom,
  isDummyPath,
  extractFilenameFromDummyPath,
  type Tab,
} from '@/stores/TabStore';
import { isFileDirtyAtom } from '@/stores/DirtyStore';
import { CloseTabWarning } from './CloseTabWarning';
import { FileIcon } from '@/components/FileIcon';
import { TabContextMenu } from './TabContextMenu';


interface TabItemProps {
  tab: Tab;
  paneId: string;
}

export function TabItem({ tab, paneId }: TabItemProps) {
  const navigate = useNavigate();
  const activeTabId = useAtomValue(paneActiveTabIdAtomFamily(paneId));
  const isDirty = useAtomValue(isFileDirtyAtom(tab.filePath));
  const switchTab = useSetAtom(switchTabAtom);
  const closeTab = useSetAtom(closeTabAtom);
  const updateTab = useSetAtom(updateTabAtom);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const tabRef = useRef<HTMLDivElement>(null);

  const isActive = tab.id === activeTabId;

  useEffect(() => {
    if (isActive) {
      tabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [isActive]);

  const handleClick = () => {
    if (!isActive) {
      switchTab(tab.id);
      // Navigate to the file path to trigger content reload
      navigate(`/editor?path=${encodeURIComponent(tab.filePath)}`);
    }
  };

  const handleDoubleClick = () => {
    if (tab.isPreview) {
      updateTab({ tabId: tab.id, updates: { isPreview: false }, paneId });
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Show warning if tab has unsaved changes
    if (isDirty) {
      setShowCloseWarning(true);
    } else {
      closeTab({ tabId: tab.id, paneId });
    }
  };

  const handleConfirmClose = (action: 'save' | 'discard' | 'cancel') => {
    setShowCloseWarning(false);

    if (action === 'discard') {
      closeTab({ tabId: tab.id, paneId });
    } else if (action === 'save') {
      // TODO: Trigger save flow, then close
      // For now, just close
      closeTab({ tabId: tab.id, paneId });
    }
    // 'cancel' does nothing
  };

  const displayName = isDummyPath(tab.filePath)
    ? extractFilenameFromDummyPath(tab.filePath)
    : (tab.fileName?.split(/[/\\]/).pop() || tab.fileName);

  return (
    <>
      <TabContextMenu tab={tab} paneId={paneId}>
        <div
          ref={tabRef}
          className={cn(
            'flex items-center gap-2 px-3 h-[35px] cursor-pointer border-r border-border group relative transition-all',
            'min-w-[120px] max-w-[200px]',
            isActive
              ? 'bg-layout-content text-foreground border-b border-b-transparent border-r border-r-border'
              : 'bg-layout-chrome text-muted-foreground hover:bg-muted/30 hover:text-foreground border-b border-b-transparent',
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
            'text-xs truncate flex-1',
            tab.isDeleted && 'line-through text-destructive'
          )}>
            {displayName}
          </span>

          {/* Right side interactions: Dirty Indicator + Close Button */}
          <div className="relative w-4 h-4 flex items-center justify-center">
            {/* Dirty Indicator (visible when dirty, hidden on hover to show close button) */}
            {isDirty && (
              <div
                className="w-2 h-2 rounded-full bg-blue-500/80 absolute transition-opacity group-hover:opacity-0"
                title="Unsaved changes"
              />
            )}

            {/* Close Button (visible on hover) */}
            <button
              className={cn(
                "absolute inset-0 flex items-center justify-center rounded hover:bg-muted transition-opacity",
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
