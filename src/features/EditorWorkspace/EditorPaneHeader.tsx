import * as React from 'react';
import { useSetAtom } from 'jotai';
import { X } from 'lucide-react';

import { EditorViewMode } from '@/features/EditorViewMode';
import { Pane, closePaneAtom } from '@/stores/PaneStore';

interface EditorPaneHeaderProps {
  pane: Pane;
  currentFilePath: string;
  isFocused: boolean;
  leafPanesCount: number;
}

export function EditorPaneHeader({
  pane,
  currentFilePath,
  isFocused,
  leafPanesCount,
}: EditorPaneHeaderProps): React.JSX.Element {
  const closePane = useSetAtom(closePaneAtom);

  return (
    <div
      className={[
        "h-8 shrink-0 px-3 flex items-center justify-end select-none",
        isFocused ? "bg-layout-content" : "bg-muted/10",
      ].join(" ")}
    >
      <div className="flex items-center gap-1">
        <EditorViewMode paneId={pane.id} filePath={currentFilePath} viewMode={pane.viewMode} />
        {leafPanesCount > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              closePane(pane.id);
            }}
            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground cursor-pointer ml-0.5"
            title="Close Split Pane"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
