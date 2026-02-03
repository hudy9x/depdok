import { useState } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  activeTabIdAtom,
  switchTabAtom,
  closeTabAtom,
  isDummyPath,
  extractFilenameFromDummyPath,
  type Tab,
} from '@/stores/TabStore';
import { CloseTabWarning } from './CloseTabWarning';
import { FileIcon } from '@/components/FileIcon';
import { TabContextMenu } from './TabContextMenu';

interface TabItemProps {
  tab: Tab;
}

export function TabItem({ tab }: TabItemProps) {
  const navigate = useNavigate();
  const [activeTabId] = useAtom(activeTabIdAtom);
  const switchTab = useSetAtom(switchTabAtom);
  const closeTab = useSetAtom(closeTabAtom);
  const [showCloseWarning, setShowCloseWarning] = useState(false);

  const isActive = tab.id === activeTabId;

  const handleClick = () => {
    if (!isActive) {
      switchTab(tab.id);
      // Navigate to the file path to trigger content reload
      navigate(`/editor?path=${encodeURIComponent(tab.filePath)}`);
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Show warning if tab has unsaved changes
    if (tab.isDirty) {
      setShowCloseWarning(true);
    } else {
      closeTab(tab.id);
    }
  };

  const handleConfirmClose = (action: 'save' | 'discard' | 'cancel') => {
    setShowCloseWarning(false);

    if (action === 'discard') {
      closeTab(tab.id);
    } else if (action === 'save') {
      // TODO: Trigger save flow, then close
      // For now, just close
      closeTab(tab.id);
    }
    // 'cancel' does nothing
  };

  const displayName = isDummyPath(tab.filePath)
    ? extractFilenameFromDummyPath(tab.filePath)
    : (tab.fileName?.split(/[/\\]/).pop() || tab.fileName);

  return (
    <>
      <TabContextMenu tab={tab}>
        <div
          className={cn(
            'flex items-center gap-2 px-3 h-[35px] cursor-pointer border-r border-border group relative',
            'hover:bg-accent/70 transition-colors',
            'min-w-[120px] max-w-[200px]',
            isActive ? 'bg-accent text-muted-foreground' : 'text-muted-foreground'
          )}
          onClick={handleClick}
          data-tauri-drag-region
        >
          {/* File Icon */}
          <span className="flex-shrink-0 opacity-70">
            <FileIcon filename={displayName} />
          </span>

          <span className="text-xs truncate flex-1" data-tauri-drag-region>{displayName}</span>

          {/* Right side interactions: Dirty Indicator + Close Button */}
          <div className="relative w-4 h-4 flex items-center justify-center">
            {/* Dirty Indicator (visible when dirty, hidden on hover to show close button) */}
            {tab.isDirty && (
              <div
                className="w-2 h-2 rounded-full bg-orange-500 absolute transition-opacity group-hover:opacity-0"
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
