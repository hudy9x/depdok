import { Plus } from 'lucide-react';
import type { TerminalTab } from '@/stores/TerminalStore';
import { TerminalInstance } from './TerminalInstance';
import { Button } from '@/components/ui/button';
import {
  PanelSectionGroup,
  PanelSectionItem,
  PanelSectionHandle,
} from '@/components/ui/panel-section';

interface TerminalViewportProps {
  tab: TerminalTab | undefined;
  cwd: string;
  workspaceRoot: string | null;
  isActive: boolean;
  handleAddTab: () => void;
}

export function TerminalViewport({
  tab,
  cwd,
  workspaceRoot,
  isActive,
  handleAddTab,
}: TerminalViewportProps) {
  if (!tab) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2 cursor-pointer"
          onClick={handleAddTab}
        >
          <Plus size={13} />
          New terminal
        </Button>
      </div>
    );
  }

  const splits = tab.splitIds && tab.splitIds.length > 0 ? tab.splitIds : [tab.id];

  return (
    <PanelSectionGroup className="w-full h-full">
      {splits.flatMap((sid, idx) => {
        const isLast = idx === splits.length - 1;
        const items = [];

        if (isLast) {
          items.push(
            <PanelSectionItem key={sid} flex={1}>
              <TerminalInstance
                tab={tab}
                sessionId={sid}
                cwd={cwd}
                workspaceRoot={workspaceRoot}
                isActive={isActive}
              />
            </PanelSectionItem>
          );
        } else {
          items.push(
            <PanelSectionItem
              key={sid}
              id={sid}
              minWidth={150}
              maxWidth={800}
              defaultWidth={300}
            >
              <TerminalInstance
                tab={tab}
                sessionId={sid}
                cwd={cwd}
                workspaceRoot={workspaceRoot}
                isActive={isActive}
              />
            </PanelSectionItem>
          );
          items.push(
            <PanelSectionHandle key={`${sid}-handle`} targetId={sid} />
          );
        }

        return items;
      })}
    </PanelSectionGroup>
  );
}
