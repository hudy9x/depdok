import * as React from 'react';
import { X } from 'lucide-react';

import { EditorBreadcrumbs } from '@/features/Editor/EditorBreadcrumbs';

interface EditorPaneHeaderProps {
  filePath?: string;
  onClose?: () => void;
}

export function EditorPaneHeader({
  filePath,
  onClose,
}: EditorPaneHeaderProps): React.JSX.Element {
  return (
    <div className="h-8 px-2.5 flex items-center justify-between border-b border-border/40 bg-layout-content select-none shrink-0 z-10 min-w-0">
      <div className="flex items-center min-w-0 flex-1 overflow-hidden pr-2">
        {filePath ? <EditorBreadcrumbs filePath={filePath} /> : null}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onClose && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all duration-150 border border-border/50 shadow-xs cursor-pointer group/close"
            title="Close Panel"
            aria-label="Close Panel"
          >
            <X className="w-3.5 h-3.5 transition-transform group-hover/close:scale-110" />
          </button>
        )}
      </div>
    </div>
  );
}
