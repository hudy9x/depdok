import * as React from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { PaneNode } from '@/stores/PaneStore';
import { PaneTree } from './PaneTree';

interface PaneSplitProps {
  node: Extract<PaneNode, { type: 'split' }>;
}

function childId(node: PaneNode): string {
  return node.type === 'leaf' ? node.pane.id : node.id;
}

export function PaneSplit({ node }: PaneSplitProps): React.JSX.Element {
  const { direction, children, sizes } = node;

  return (
    <PanelGroup
      direction={direction}
      className="w-full h-full"
    >
      {children.map((child, idx) => {
        const id = childId(child);
        return (
          <React.Fragment key={id}>
            {idx > 0 && (
              <PanelResizeHandle
                className={[
                  "relative flex items-center justify-center transition-colors bg-border/40 hover:bg-primary/50",
                  direction === "horizontal"
                    ? "w-[4px] cursor-col-resize h-full"
                    : "h-[4px] cursor-row-resize w-full",
                ].join(" ")}
              />
            )}
            <Panel
              id={`panel-${id}`}
              order={idx}
              minSize={10}
              defaultSize={sizes[idx] ?? 50}
              className="relative min-w-0 min-h-0 flex"
            >
              <PaneTree node={child} />
            </Panel>
          </React.Fragment>
        );
      })}
    </PanelGroup>
  );
}
