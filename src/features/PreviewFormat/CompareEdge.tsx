import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { FormatBlockType } from "@/lib/format-parser";
import { DiffViewer } from "./DiffViewer";

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

  const onDeleteClick = () => {
    if (data && typeof data.onDeleteEdge === 'function') {
      data.onDeleteEdge(id);
    }
  };

  const sourceContent = typeof data?.sourceContent === 'string' ? data.sourceContent : "";
  const targetContent = typeof data?.targetContent === 'string' ? data.targetContent : "";
  const formatType = (data?.formatType as FormatBlockType) || 'text';

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
          className="nodrag nopan flex flex-col w-[500px] max-w-[80vw]"
        >
          <DiffViewer
            sourceContent={sourceContent}
            targetContent={targetContent}
            formatType={formatType}
            onClose={onDeleteClick}
          />
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
