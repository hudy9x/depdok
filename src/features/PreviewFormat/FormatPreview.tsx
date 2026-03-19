import { useState, useCallback, useEffect, useMemo } from "react";
import { Braces, Code, FileCode, FileJson } from "lucide-react";
import { parseFormatFile, appendBlock, replaceBlockContent, deleteBlockContent, updateBlockMetadata, FormatBlockType } from "@/lib/format-parser";
import { FormatBlock, FormatBlockNodeData } from "./FormatBlock";
import { CompareEdge } from "./CompareEdge";
import { DiffDialog } from "./DiffDialog";
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  Node,
  Edge,
  Connection,
  ReactFlowInstance,
  getBezierPath,
  ConnectionLineComponentProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";

interface FormatPreviewProps {
  content: string;
  editable?: boolean;
  onContentChange?: (newContent: string) => void;
}

const BLOCK_TYPES: { type: FormatBlockType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: "json", label: "JSON", icon: <FileJson className="w-3.5 h-3.5" />, color: "text-yellow-600 dark:text-yellow-400 border-yellow-500/40 hover:bg-yellow-500/10" },
  { type: "xml", label: "XML", icon: <FileCode className="w-3.5 h-3.5" />, color: "text-blue-600 dark:text-blue-400 border-blue-500/40 hover:bg-blue-500/10" },
  { type: "html", label: "HTML", icon: <Code className="w-3.5 h-3.5" />, color: "text-orange-600 dark:text-orange-400 border-orange-500/40 hover:bg-orange-500/10" },
  { type: "yaml", label: "YAML", icon: <Braces className="w-3.5 h-3.5" />, color: "text-purple-600 dark:text-purple-400 border-purple-500/40 hover:bg-purple-500/10" },
];

const CustomConnectionLine = ({
  fromX,
  fromY,
  toX,
  toY,
  connectionStatus,
}: ConnectionLineComponentProps) => {
  const [edgePath] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    targetX: toX,
    targetY: toY,
  });

  let strokeClass = "text-muted-foreground";
  if (connectionStatus === "valid") {
    strokeClass = "text-emerald-500";
  } else if (connectionStatus === "invalid") {
    strokeClass = "text-red-500";
  }

  return (
    <g>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={4}
        className={strokeClass}
        d={edgePath}
      />
    </g>
  );
};

const nodeTypes = {
  formatBlock: FormatBlock,
};

const edgeTypes = {
  compareEdge: CompareEdge,
};

export function FormatPreview({ content, editable = false, onContentChange }: FormatPreviewProps) {
  const { resolvedTheme } = useTheme();
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [localContent, setLocalContent] = useState(content);

  // Sync from props if external changes arrive
  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  const parsedBlocks = useMemo(() => parseFormatFile(localContent), [localContent]);
  const hasTypedBlocks = parsedBlocks.some((b) => b.type !== "text");

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [diffOpen, setDiffOpen] = useState(false);
  const [diffSourceId, setDiffSourceId] = useState<string | null>(null);
  const [diffTargetId, setDiffTargetId] = useState<string | null>(null);

  const handleAddBlock = useCallback((type: FormatBlockType, initialContent?: string) => {
    let position = undefined;
    if (rfInstance) {
      // Get the center of the ReactFlow container
      const domNode = document.querySelector('.react-flow') as HTMLElement;
      if (domNode) {
        const rect = domNode.getBoundingClientRect();
        // Project the screen center to flow coordinates
        position = rfInstance.screenToFlowPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        });
        // Offset slightly so it spawns roughly in the middle, assuming block is ~300x200
        position.x -= 150;
        position.y -= 100;

        position.x = Math.round(position.x);
        position.y = Math.round(position.y);
      }
    }

    const updated = appendBlock(localContent, type, initialContent, position ? { position } : undefined);
    setLocalContent(updated);
    onContentChange?.(updated);
  }, [localContent, onContentChange, rfInstance]);

  const handlePaste = useCallback((e: React.ClipboardEvent | ClipboardEvent) => {
    // Check if the user is typing inside an input/textarea
    // We only want to intercept global pastes on the canvas
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }

    const text = 'clipboardData' in e
      ? e.clipboardData?.getData("text")
      : (e as any).clipboardData?.getData("text");

    if (!text) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    let detectedType: FormatBlockType | null = null;

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        JSON.parse(trimmed);
        detectedType = "json";
      } catch { }
    } else if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
      detectedType = "xml";
    } else if (/^[\w-]+:\s/m.test(trimmed)) {
      detectedType = "yaml";
    }

    if (detectedType) {
      e.preventDefault();
      handleAddBlock(detectedType, text);
    }
  }, [handleAddBlock]);

  // Attach global paste listener if we're focused
  useEffect(() => {
    const onGlobalPaste = (e: ClipboardEvent) => handlePaste(e);
    document.addEventListener("paste", onGlobalPaste);
    return () => document.removeEventListener("paste", onGlobalPaste);
  }, [handlePaste]);

  const handleBlockContentChange = useCallback((blockIndex: number, newBlockContent: string) => {
    const updated = replaceBlockContent(localContent, parsedBlocks, blockIndex, newBlockContent);
    setLocalContent(updated);
    onContentChange?.(updated);
  }, [localContent, parsedBlocks, onContentChange]);

  const handleDeleteBlock = useCallback((blockIndex: number) => {
    const updated = deleteBlockContent(localContent, parsedBlocks, blockIndex);
    setLocalContent(updated);
    onContentChange?.(updated);
  }, [localContent, parsedBlocks, onContentChange]);

  const handleDeleteEdge = useCallback((edgeId: string) => {
    const match = edgeId.match(/e-block-(\d+)-block-(\d+)/);
    if (!match) return;
    const sourceIndex = parseInt(match[1]);
    const targetIndex = parseInt(match[2]);
    const block = parsedBlocks[sourceIndex];
    if (!block) return;
    
    const connections = (block.metadata?.connections || []).filter((idx: number) => idx !== targetIndex);
    const newMetadata = { ...block.metadata, connections };
    if (connections.length === 0) delete newMetadata.connections;
    
    const updated = updateBlockMetadata(localContent, parsedBlocks, sourceIndex, newMetadata);
    setLocalContent(updated);
    onContentChange?.(updated);
  }, [localContent, parsedBlocks, onContentChange]);

  const handleCompare = useCallback((sourceId: string, targetId: string) => {
    const sourceIndex = parseInt(sourceId.replace("block-", ""));
    const targetIndex = parseInt(targetId.replace("block-", ""));
    const block = parsedBlocks[sourceIndex];
    if (!block) return;
    
    const connections = Array.from(new Set([...(block.metadata?.connections || []), targetIndex]));
    const newMetadata = { ...block.metadata, connections };
    
    const updated = updateBlockMetadata(localContent, parsedBlocks, sourceIndex, newMetadata);
    setLocalContent(updated);
    onContentChange?.(updated);
  }, [localContent, parsedBlocks, onContentChange]);

  const onConnect = useCallback((connection: Connection) => {
    handleCompare(connection.source, connection.target);
  }, [handleCompare]);

  const isValidConnection = useCallback(
    (connection: Edge | Connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      const sourceType = (sourceNode?.data as unknown as FormatBlockNodeData)?.type;
      const targetType = (targetNode?.data as unknown as FormatBlockNodeData)?.type;
      return sourceType === targetType && connection.source !== connection.target;
    },
    [nodes]
  );

  // Handle drag stop to save node position
  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    const blockIndex = parseInt(node.id.replace("block-", ""));
    const block = parsedBlocks[blockIndex];
    if (!block) return;

    // Preserve existing metadata, only update position
    const newMetadata = {
      ...(block.metadata || {}),
      position: { x: Math.round(node.position.x), y: Math.round(node.position.y) }
    };

    const updated = updateBlockMetadata(localContent, parsedBlocks, blockIndex, newMetadata);
    setLocalContent(updated);
    onContentChange?.(updated);
  }, [localContent, parsedBlocks, onContentChange]);

  // Sync parsed blocks to React Flow nodes
  useEffect(() => {
    setNodes((currentNodes) => {
      const newNodes: Node<FormatBlockNodeData>[] = parsedBlocks
        .map((block, index) => {
          if (block.type === "text") return null;

          const nodeId = `block-${index}`;
          const existingNode = currentNodes.find((n) => n.id === nodeId);

          const savedPosition = block.metadata?.position;

          return {
            id: nodeId,
            type: "formatBlock",
            dragHandle: '.custom-drag-handle',
            position: savedPosition
              ? savedPosition
              : (existingNode ? existingNode.position : { x: 250 * (index % 3), y: Math.floor(index / 3) * 400 }),
            data: {
              type: block.type,
              label: block.label,
              content: block.content,
              editable,
              onContentChange: (newContent: string) => handleBlockContentChange(index, newContent),
              onDelete: () => handleDeleteBlock(index),
            },
          };
        })
        .filter(Boolean) as Node<FormatBlockNodeData>[];

      return newNodes;
    });

    setEdges(() => {
      const newEdges: Edge[] = [];
      parsedBlocks.forEach((block, index) => {
        const connections = block.metadata?.connections;
        if (Array.isArray(connections)) {
          connections.forEach((targetIndex: number) => {
            const edgeId = `e-block-${index}-block-${targetIndex}`;
            newEdges.push({
              id: edgeId,
              source: `block-${index}`,
              target: `block-${targetIndex}`,
              type: "compareEdge",
              animated: true,
              data: {
                onDiffClick: () => {
                  setDiffSourceId(`block-${index}`);
                  setDiffTargetId(`block-${targetIndex}`);
                  setDiffOpen(true);
                },
                onDeleteEdge: () => handleDeleteEdge(edgeId),
              },
            });
          });
        }
      });
      return newEdges;
    });
  }, [parsedBlocks, editable, handleBlockContentChange, handleDeleteBlock, handleDeleteEdge, setNodes, setEdges]);

  // Handle Diff dialog content lookup
  const diffSourceBlock = diffSourceId ? parsedBlocks[parseInt(diffSourceId.replace("block-", ""))] : null;
  const diffTargetBlock = diffTargetId ? parsedBlocks[parseInt(diffTargetId.replace("block-", ""))] : null;

  // Empty state
  if (!hasTypedBlocks) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">
          No blocks yet. Add a section to get started.
        </p>
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {BLOCK_TYPES.map(({ type, label, icon, color }) => (
            <button
              key={type}
              onClick={() => handleAddBlock(type)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${color}`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground/60">
          Or type <code className="px-1 rounded bg-muted">~~~json</code> directly in the editor
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-muted outline-none" tabIndex={0}>
      <ReactFlow
        colorMode={resolvedTheme === "dark" ? "dark" : "light"}
        nodes={nodes}
        edges={edges}
        onInit={setRfInstance}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ style: { strokeWidth: 4 } }}
        connectionLineComponent={CustomConnectionLine}
        fitView
      >
        <Background />
        <Controls position="bottom-right" />
      </ReactFlow>

      {/* Add section buttons — absolutely pinned to bottom */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-background/80 backdrop-blur rounded-full border border-border shadow-lg z-50">
        {BLOCK_TYPES.map(({ type, label, icon, color }) => (
          <button
            key={type}
            onClick={() => handleAddBlock(type)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${color}`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      <DiffDialog
        open={diffOpen}
        onOpenChange={setDiffOpen}
        title={`Diff: ${diffSourceBlock?.label || diffSourceBlock?.type} vs ${diffTargetBlock?.label || diffTargetBlock?.type}`}
        sourceContent={diffSourceBlock?.content || ""}
        targetContent={diffTargetBlock?.content || ""}
        formatType={diffSourceBlock?.type as FormatBlockType}
      />
    </div>
  );
}
