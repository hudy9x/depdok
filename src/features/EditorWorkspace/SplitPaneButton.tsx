import * as React from 'react';
import { useSetAtom } from 'jotai';
import { Columns2, Rows } from 'lucide-react';
import { splitPaneAtom } from '@/stores/PaneStore';

interface SplitPaneButtonProps {
  paneId: string;
}

export function SplitPaneButton({ paneId }: SplitPaneButtonProps): React.JSX.Element {
  const splitPane = useSetAtom(splitPaneAtom);

  return (
    <div className="flex items-center gap-0.5 px-2 h-full border-l border-border/10">
      <button
        onClick={() => splitPane({ paneId, direction: 'horizontal' })}
        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
        title="Split Editor Right (Cmd+\)"
      >
        <Columns2 className="w-4 h-4" />
      </button>
      <button
        onClick={() => splitPane({ paneId, direction: 'vertical' })}
        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
        title="Split Editor Down (Cmd+Shift+\)"
      >
        <Rows className="w-4 h-4" />
      </button>
    </div>
  );
}
