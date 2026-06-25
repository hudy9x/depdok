import * as React from 'react';
import { PaneNode } from '@/stores/PaneStore';
import { PaneSplit } from './PaneSplit';
import { EditorPane } from './EditorPane';

interface PaneTreeProps {
  node: PaneNode;
}

export function PaneTree({ node }: PaneTreeProps): React.JSX.Element {
  if (node.type === 'split') {
    return <PaneSplit node={node} />;
  }
  return <EditorPane pane={node.pane} />;
}
