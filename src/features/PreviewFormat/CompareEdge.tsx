import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { SplitSquareHorizontal, X } from 'lucide-react';

export function CompareEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onDiffClick = () => {
    if (data && typeof data.onDiffClick === 'function') {
      data.onDiffClick(id);
    }
  };

  const onDeleteClick = () => {
    if (data && typeof data.onDeleteEdge === 'function') {
      data.onDeleteEdge(id);
    }
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeWidth: 4 }} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all', // Important for clicks to work on label
          }}
          className="nodrag nopan"
        >
          <div className="flex items-center gap-1 bg-background border border-primary/30 rounded-full shadow-sm p-1">
            <button
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
              onClick={onDiffClick}
            >
              <SplitSquareHorizontal className="w-3.5 h-3.5" />
              Diff
            </button>
            <div className="w-px h-3.5 bg-border mx-0.5" />
            <button
              className="flex items-center justify-center w-5 h-5 rounded-full text-muted-foreground hover:bg-red-500/20 hover:text-red-500 transition-colors cursor-pointer"
              onClick={onDeleteClick}
              title="Remove comparison"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
