import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Graph from 'graphology';
import ForceSupervisor from 'graphology-layout-force/worker';
import Sigma from 'sigma';
import { EdgeArrowProgram } from 'sigma/rendering';
import { Minus, Plus, RefreshCw, RotateCcw, ExternalLink, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useSetAtom } from 'jotai';

import { Button } from "@/components/ui/button";
import {
  connectDocuments,
  deleteDocument,
  deleteConnection,
  getProjectGraph,
  type KnowledgeGraphData
} from "@/api-client/knowledge-base";
import { getKnowledgeGraphGroupId } from "@/lib/knowledgeGraph";
import { createTabAtom } from '@/stores/TabStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface KnowledgeGraphPreviewProps {
  filePath: string;
}

interface FileGraphNode {
  id: string;
  label: string;
  folderPath: string;
  representativeDocumentId: string;
}

interface FileGraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: string;
  strength: number;
}

interface FileGraphData {
  nodes: FileGraphNode[];
  edges: FileGraphEdge[];
}

interface HoverInfo {
  x: number;
  y: number;
  label: string;
  folderPath: string;
  degree: number;
}

const COLOR_DEFAULT = '#2563eb';
const COLOR_SELECTED = '#f97316';
const COLOR_NEIGHBOR = '#fb923c';
const COLOR_DIMMED = '#cbd5e1';
const COLOR_EDGE_DEFAULT = '#64748b';
const COLOR_EDGE_ACTIVE = '#94a3b8';
const COLOR_EDGE_DIMMED = '#e2e8f0';

function toFileDocumentId(documentId: string): string {
  const sectionMarkerIndex = documentId.indexOf('#section:');
  if (sectionMarkerIndex >= 0) {
    return documentId.slice(0, sectionMarkerIndex);
  }
  return documentId;
}

function toFileLabel(documentId: string): string {
  if (!documentId.startsWith('file:')) {
    return documentId;
  }

  const filePath = documentId.slice(5);
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || filePath;
}

function toFolderPath(documentId: string): string {
  if (!documentId.startsWith('file:')) {
    return '';
  }

  const filePath = documentId.slice(5).replace(/\\/g, '/');
  const parts = filePath.split('/').filter(Boolean);
  if (parts.length <= 1) {
    return '.';
  }

  return parts.slice(0, -1).join('/');
}

function drawFileNodeLabel(
  context: CanvasRenderingContext2D,
  data: { x: number; y: number; size: number; label: string | null }
): void {
  const rawLabel = data.label ?? '';
  if (!rawLabel) {
    return;
  }
  const [fileName, folderPath] = rawLabel.split('\n');
  const x = data.x + data.size + 4;
  const y = data.y;

  context.textAlign = 'left';
  context.textBaseline = 'middle';

  context.font = '500 13px Assistant, sans-serif';
  context.fillStyle = '#0f172a';
  context.fillText(fileName ?? rawLabel, x, y - 5);

  if (folderPath) {
    context.font = '400 11px Assistant, sans-serif';
    context.fillStyle = '#64748b';
    context.fillText(folderPath, x, y + 9);
  }
}

function toFileGraphData(data: KnowledgeGraphData): FileGraphData {
  const nodeMap = new Map<string, FileGraphNode>();
  const edgeMap = new Map<string, FileGraphEdge>();

  for (const document of data.documents) {
    const fileId = toFileDocumentId(document.id);
    if (nodeMap.has(fileId)) {
      continue;
    }

    nodeMap.set(fileId, {
      id: fileId,
      label: toFileLabel(fileId),
      folderPath: toFolderPath(fileId),
      representativeDocumentId: document.id,
    });
  }

  for (const edge of data.edges) {
    const sourceFileId = toFileDocumentId(edge.sourceId);
    const targetFileId = toFileDocumentId(edge.targetId);

    if (sourceFileId === targetFileId) {
      continue;
    }

    if (!nodeMap.has(sourceFileId) || !nodeMap.has(targetFileId)) {
      continue;
    }

    const key = `${sourceFileId}=>${targetFileId}`;
    const existing = edgeMap.get(key);

    if (existing) {
      existing.strength += 1;
      continue;
    }

    edgeMap.set(key, {
      id: key,
      sourceId: sourceFileId,
      targetId: targetFileId,
      edgeType: edge.edgeType ?? 'related',
      strength: 1,
    });
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };
}

function buildGraph(data: FileGraphData): Graph {
  const graph = new Graph({ multi: true, type: 'directed' });

  for (const node of data.nodes) {
    graph.addNode(node.id, {
      label: node.folderPath ? `${node.label}\n${node.folderPath}` : node.label,
      representativeDocumentId: node.representativeDocumentId,
      folderPath: node.folderPath,
      fileName: node.label,
      x: 0,
      y: 0,
      size: 10,
      highlighted: false,
      color: COLOR_DEFAULT,
    });
  }

  const groupedNodes = new Map<string, string[]>();
  for (const nodeId of graph.nodes()) {
    const folder = String(graph.getNodeAttribute(nodeId, 'folderPath') ?? '.');
    const bucket = groupedNodes.get(folder);
    if (bucket) {
      bucket.push(nodeId);
    } else {
      groupedNodes.set(folder, [nodeId]);
    }
  }

  const groups = Array.from(groupedNodes.entries()).sort(([a], [b]) => a.localeCompare(b));
  const totalGroups = Math.max(groups.length, 1);
  const columns = Math.ceil(Math.sqrt(totalGroups));
  const rows = Math.ceil(totalGroups / columns);
  const groupSpacingX = 26;
  const groupSpacingY = 22;

  groups.forEach(([, nodeIds], groupIndex) => {
    const column = groupIndex % columns;
    const row = Math.floor(groupIndex / columns);
    const centerX = (column - (columns - 1) / 2) * groupSpacingX;
    const centerY = (row - (rows - 1) / 2) * groupSpacingY;

    if (nodeIds.length === 1) {
      graph.setNodeAttribute(nodeIds[0], 'x', centerX);
      graph.setNodeAttribute(nodeIds[0], 'y', centerY);
      return;
    }

    const localRadius = Math.max(3, Math.min(9, Math.sqrt(nodeIds.length) * 2));
    nodeIds.forEach((nodeId, nodeIndex) => {
      const angle = (nodeIndex / nodeIds.length) * Math.PI * 2;
      graph.setNodeAttribute(nodeId, 'x', centerX + Math.cos(angle) * localRadius);
      graph.setNodeAttribute(nodeId, 'y', centerY + Math.sin(angle) * localRadius);
    });
  });

  for (const edge of data.edges) {
    if (!graph.hasNode(edge.sourceId) || !graph.hasNode(edge.targetId)) {
      continue;
    }

    graph.addEdgeWithKey(edge.id, edge.sourceId, edge.targetId, {
      label: edge.strength > 1 ? `${edge.edgeType} (${edge.strength})` : edge.edgeType,
      color: COLOR_EDGE_DEFAULT,
      size: Math.min(1.5 + edge.strength * 0.5, 6),
    });
  }

  return graph;
}

export function KnowledgeGraphPreview({ filePath }: KnowledgeGraphPreviewProps) {
  const groupId = useMemo(() => getKnowledgeGraphGroupId(filePath), [filePath]);
  const [data, setData] = useState<KnowledgeGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  interface ContextMenuState {
    x: number;
    y: number;
    type: 'node' | 'edge';
    targetId: string;
    sourceId?: string;
    targetNodeId?: string;
  }

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'node' | 'edge';
    id: string;
    sourceId?: string;
    targetId?: string;
  } | null>(null);

  const createTab = useSetAtom(createTabAtom);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const layoutRef = useRef<ForceSupervisor | null>(null);
  const selectedNodeRef = useRef<string | null>(null);
  const activeFolderRef = useRef<string | null>(null);
  const isConnectingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const draggedNodeRef = useRef<string | null>(null);
  const dragMovedRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const fileGraphData = useMemo(() => (data ? toFileGraphData(data) : null), [data]);

  const folders = useMemo(() => {
    if (!fileGraphData) return [];
    const set = new Set(fileGraphData.nodes.map((n) => n.folderPath).filter(Boolean));
    return Array.from(set).sort();
  }, [fileGraphData]);

  const refreshColors = useCallback(() => {
    const graph = graphRef.current;
    const renderer = sigmaRef.current;
    if (!graph || !renderer) return;

    const selected = selectedNodeRef.current;
    const folder = activeFolderRef.current;
    const neighbors = selected ? new Set(graph.neighbors(selected)) : null;

    for (const nodeId of graph.nodes()) {
      const nodeFolder = String(graph.getNodeAttribute(nodeId, 'folderPath') ?? '');
      const folderMatch = !folder || nodeFolder === folder;
      let color: string;

      if (!folderMatch) {
        color = COLOR_DIMMED;
      } else if (selected) {
        if (nodeId === selected) color = COLOR_SELECTED;
        else if (neighbors?.has(nodeId)) color = COLOR_NEIGHBOR;
        else color = COLOR_DIMMED;
      } else {
        color = COLOR_DEFAULT;
      }

      graph.setNodeAttribute(nodeId, 'color', color);
    }

    for (const edgeId of graph.edges()) {
      const source = graph.source(edgeId);
      const target = graph.target(edgeId);
      const sourceFolder = String(graph.getNodeAttribute(source, 'folderPath') ?? '');
      const targetFolder = String(graph.getNodeAttribute(target, 'folderPath') ?? '');
      let edgeColor: string;

      if (selected) {
        const connected = source === selected || target === selected;
        edgeColor = connected ? COLOR_EDGE_ACTIVE : COLOR_EDGE_DIMMED;
      } else if (folder) {
        const inFolder = sourceFolder === folder || targetFolder === folder;
        edgeColor = inFolder ? COLOR_EDGE_ACTIVE : COLOR_EDGE_DIMMED;
      } else {
        edgeColor = COLOR_EDGE_DEFAULT;
      }

      graph.setEdgeAttribute(edgeId, 'color', edgeColor);
    }

    renderer.refresh();
  }, []);

  const loadGraph = async () => {
    setLoading(true);
    setError(null);

    try {
      const graph = await getProjectGraph(groupId);
      setData(graph);
    } catch (loadError) {
      console.error("[KnowledgeGraphPreview] Failed to load project graph:", loadError);
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const handleOpenNodeFile = (nodeId: string) => {
    setContextMenu(null);
    if (!nodeId.startsWith('file:')) return;
    const realPath = nodeId.replace(/^file:/, '');
    const fileName = toFileLabel(nodeId);
    createTab({
      filePath: realPath,
      fileName,
      switchTo: true,
    });
  };

  const handleConfirmDeleteNode = (nodeId: string) => {
    setContextMenu(null);
    setDeleteConfirm({
      type: 'node',
      id: nodeId,
    });
  };

  const handleConfirmDeleteEdge = (edgeId: string) => {
    setContextMenu(null);
    const graph = graphRef.current;
    if (!graph || !graph.hasEdge(edgeId)) return;
    const source = graph.source(edgeId);
    const target = graph.target(edgeId);

    setDeleteConfirm({
      type: 'edge',
      id: edgeId,
      sourceId: source,
      targetId: target,
    });
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    const { type, id, sourceId, targetId } = deleteConfirm;
    setDeleteConfirm(null);

    const toastId = toast.loading(
      type === 'node' ? 'Deleting document from knowledge base...' : 'Removing connection...'
    );

    try {
      if (type === 'node') {
        await deleteDocument(id);
        toast.success('Document deleted from knowledge base successfully', { id: toastId });
      } else {
        await deleteConnection(sourceId!, targetId!);
        toast.success('Connection removed successfully', { id: toastId });
      }

      // Reload graph data
      await loadGraph();
    } catch (err) {
      console.error(err);
      toast.error(
        type === 'node' ? 'Failed to delete document' : 'Failed to remove connection',
        { id: toastId }
      );
    }
  };

  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleClose);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
    };
  }, []);

  // Sync activeFolder ref and refresh colors when filter changes
  useEffect(() => {
    activeFolderRef.current = activeFolder;
    refreshColors();
  }, [activeFolder, refreshColors]);

  useEffect(() => {
    if (!fileGraphData || !containerRef.current) {
      return;
    }

    const graph = buildGraph(fileGraphData);
    graphRef.current = graph;

    const renderer = new Sigma(graph, containerRef.current, {
      renderEdgeLabels: true,
      allowInvalidContainer: false,
      labelDensity: 0.09,
      labelGridCellSize: 100,
      labelRenderedSizeThreshold: 8,
      defaultEdgeType: 'arrow',
      defaultDrawNodeLabel: drawFileNodeLabel,
      edgeProgramClasses: {
        arrow: EdgeArrowProgram,
      },
      zIndex: true,
    });

    const layout = new ForceSupervisor(graph, {
      isNodeFixed: (_nodeId, attrs) => Boolean(attrs.highlighted),
      settings: {
        gravity: 0.02,
        attraction: 0.0009,
        repulsion: 0.08,
        inertia: 0.8,
      },
    });
    layout.start();

    layoutRef.current = layout;
    sigmaRef.current = renderer;
    selectedNodeRef.current = null;

    // ── Drag to rearrange ──────────────────────────────────────────────────
    renderer.on('downNode', ({ node, event }) => {
      isDraggingRef.current = true;
      draggedNodeRef.current = node;
      dragMovedRef.current = false;
      graph.setNodeAttribute(node, 'highlighted', true);
      if (!renderer.getCustomBBox()) {
        renderer.setCustomBBox(renderer.getBBox());
      }
      // Record offset between the cursor (in graph space) and the node centre
      // so the node doesn't snap/jump to the cursor on the first move.
      const mouseGraphPos = renderer.viewportToGraph(event);
      const nodeX = graph.getNodeAttribute(node, 'x') as number;
      const nodeY = graph.getNodeAttribute(node, 'y') as number;
      dragOffsetRef.current = {
        x: nodeX - mouseGraphPos.x,
        y: nodeY - mouseGraphPos.y,
      };
    });

    renderer.getMouseCaptor().on('mousemovebody', (e) => {
      if (!isDraggingRef.current || !draggedNodeRef.current) return;
      dragMovedRef.current = true;
      const pos = renderer.viewportToGraph(e);
      graph.setNodeAttribute(draggedNodeRef.current, 'x', pos.x + dragOffsetRef.current.x);
      graph.setNodeAttribute(draggedNodeRef.current, 'y', pos.y + dragOffsetRef.current.y);
      e.preventSigmaDefault();
      e.original.preventDefault();
      e.original.stopPropagation();
    });

    const handleDragEnd = () => {
      const draggedNode = draggedNodeRef.current;
      if (draggedNode) {
        graph.setNodeAttribute(draggedNode, 'highlighted', false);
      }
      isDraggingRef.current = false;
      draggedNodeRef.current = null;
      dragOffsetRef.current = { x: 0, y: 0 };
    };

    renderer.getMouseCaptor().on('mouseup', () => {
      handleDragEnd();
    });
    renderer.on('upNode', handleDragEnd);
    renderer.on('upStage', handleDragEnd);

    // ── Hover tooltip ──────────────────────────────────────────────────────
    renderer.on('enterNode', ({ node, event }) => {
      const fileName = String(graph.getNodeAttribute(node, 'fileName') ?? '');
      const nodeFolder = String(graph.getNodeAttribute(node, 'folderPath') ?? '');
      const degree = graph.degree(node);
      setHoverInfo({ x: event.x, y: event.y, label: fileName, folderPath: nodeFolder, degree });
    });

    renderer.on('leaveNode', () => {
      setHoverInfo(null);
    });

    // ── Click: highlight neighbors or connect ──────────────────────────────
    const onClickNode = async ({ node }: { node: string }) => {
      setContextMenu(null);
      if (isConnectingRef.current || dragMovedRef.current) {
        dragMovedRef.current = false;
        return;
      }

      const current = selectedNodeRef.current;

      // No selection yet, or re-clicking the same node → toggle highlight
      if (!current || current === node) {
        selectedNodeRef.current = current === node ? null : node;
        refreshColors();
        return;
      }

      // Two different nodes selected → connect them
      isConnectingRef.current = true;
      try {
        const sourceDocumentId = String(graph.getNodeAttribute(current, 'representativeDocumentId') ?? '');
        const targetDocumentId = String(graph.getNodeAttribute(node, 'representativeDocumentId') ?? '');

        if (!sourceDocumentId || !targetDocumentId) {
          throw new Error('Missing representative document id for selected file');
        }

        await connectDocuments(sourceDocumentId, targetDocumentId);

        const fileEdgeKey = `${current}=>${node}`;
        if (!graph.hasEdge(fileEdgeKey)) {
          graph.addEdgeWithKey(fileEdgeKey, current, node, {
            color: COLOR_EDGE_DEFAULT,
            size: 2,
            label: 'related',
          });
        } else {
          const existingLabel = String(graph.getEdgeAttribute(fileEdgeKey, 'label') ?? 'related');
          const countMatch = existingLabel.match(/\((\d+)\)$/);
          const nextCount = countMatch ? Number(countMatch[1]) + 1 : 2;
          graph.setEdgeAttribute(fileEdgeKey, 'label', `related (${nextCount})`);
          graph.setEdgeAttribute(fileEdgeKey, 'size', Math.min(1.5 + nextCount * 0.5, 6));
        }

        selectedNodeRef.current = null;
        refreshColors();
      } catch (connectError) {
        console.error('[KnowledgeGraphPreview] Failed to connect nodes:', connectError);
        toast.error('Failed to connect documents');
      } finally {
        isConnectingRef.current = false;
      }
    };

    renderer.on('clickNode', onClickNode);

    // Click on empty stage → deselect
    renderer.on('clickStage', () => {
      selectedNodeRef.current = null;
      refreshColors();
      setContextMenu(null);
    });

    // Right click node
    renderer.on('rightClickNode', ({ node, event }) => {
      event.preventSigmaDefault();
      event.original.preventDefault();
      event.original.stopPropagation();

      setContextMenu({
        x: event.x,
        y: event.y,
        type: 'node',
        targetId: node,
      });
    });

    // Right click edge
    renderer.on('rightClickEdge', ({ edge, event }) => {
      event.preventSigmaDefault();
      event.original.preventDefault();
      event.original.stopPropagation();

      const source = graph.source(edge);
      const target = graph.target(edge);

      setContextMenu({
        x: event.x,
        y: event.y,
        type: 'edge',
        targetId: edge,
        sourceId: source,
        targetNodeId: target,
      });
    });

    // Right click stage
    renderer.on('rightClickStage', ({ event }) => {
      event.preventSigmaDefault();
      event.original.preventDefault();
      setContextMenu(null);
    });

    return () => {
      renderer.removeAllListeners();
      layout.stop();
      layout.kill();
      renderer.kill();
      layoutRef.current = null;
      sigmaRef.current = null;
      graphRef.current = null;
      selectedNodeRef.current = null;
      setHoverInfo(null);
      setContextMenu(null);
    };
  }, [fileGraphData, refreshColors]);

  const handleZoom = (direction: 'in' | 'out') => {
    const renderer = sigmaRef.current;
    if (!renderer) return;

    const camera = renderer.getCamera();
    const ratio = camera.getState().ratio;
    const factor = direction === 'in' ? 1 / 1.25 : 1.25;

    camera.animate({ ratio: ratio * factor }, { duration: 150 });
  };

  const handleResetView = () => {
    const renderer = sigmaRef.current;
    if (!renderer) return;
    renderer.getCamera().animatedReset({ duration: 180 });
  };

  if (loading) {
    return <div className="w-full h-full flex items-center justify-center text-muted-foreground">Loading knowledge graph…</div>;
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <p>Failed to load knowledge graph.</p>
        <Button variant="outline" size="sm" onClick={loadGraph} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (!fileGraphData || fileGraphData.nodes.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <p className="text-sm font-medium">No graph data yet</p>
        <p className="text-xs max-w-sm text-center">Save Markdown documents in this project to populate the knowledge graph.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-layout-content">
      {/* Info panel */}
      <div className="absolute top-3 left-3 z-10 rounded-md border border-border bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur">
        <div className="font-semibold text-foreground">{data?.groupTitle ?? 'Knowledge Graph'}</div>
        <div>{fileGraphData.nodes.length} files, {fileGraphData.edges.length} connections</div>
        {/* <div className="mt-1">Click a node to highlight · click two nodes to connect · drag to rearrange</div> */}
      </div>

      {/* Folder filter buttons */}
      {folders.length > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex flex-wrap items-center gap-1 rounded-md border border-border bg-background/90 px-2 py-1.5 shadow-sm backdrop-blur max-w-lg">
          <button
            type="button"
            onClick={() => setActiveFolder(null)}
            className={`rounded px-2 py-0.5 text-xs transition-colors ${activeFolder === null
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
          >
            All
          </button>
          {folders.map((folder) => (
            <button
              key={folder}
              type="button"
              onClick={() => setActiveFolder(activeFolder === folder ? null : folder)}
              className={`rounded px-2 py-0.5 text-xs transition-colors ${activeFolder === folder
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              title={folder}
            >
              {folder.split('/').pop() ?? folder}
            </button>
          ))}
        </div>
      )}

      {/* Zoom / reset controls */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" onClick={() => handleZoom('in')} title="Zoom in">
          <Plus className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={() => handleZoom('out')} title="Zoom out">
          <Minus className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={handleResetView} title="Reset view">
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={loadGraph} title="Reload graph">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Hover tooltip */}
      {hoverInfo && (
        <div
          className="pointer-events-none absolute z-20 rounded-md border bg-background/95 px-3 py-2 text-xs shadow-md backdrop-blur"
          style={{ left: hoverInfo.x + 14, top: hoverInfo.y - 14 }}
        >
          <div className="font-semibold text-foreground">{hoverInfo.label}</div>
          {hoverInfo.folderPath && (
            <div className="text-muted-foreground">{hoverInfo.folderPath}</div>
          )}
          <div className="mt-1 text-muted-foreground">{hoverInfo.degree} connection{hoverInfo.degree !== 1 ? 's' : ''}</div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="absolute z-30 min-w-[160px] rounded-lg border border-border bg-background/90 backdrop-blur-md p-1 shadow-lg animate-in fade-in zoom-in-95 duration-100"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {contextMenu.type === 'node' ? (
            <>
              {contextMenu.targetId.startsWith('file:') && (
                <button
                  type="button"
                  onClick={() => handleOpenNodeFile(contextMenu.targetId)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-accent hover:text-accent-foreground transition-colors text-left cursor-pointer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open File
                </button>
              )}
              <button
                type="button"
                onClick={() => handleConfirmDeleteNode(contextMenu.targetId)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors text-left cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete from Graph
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => handleConfirmDeleteEdge(contextMenu.targetId)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors text-left cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove Connection
            </button>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm leading-relaxed">
              {deleteConfirm?.type === 'node' ? (
                <>
                  Are you sure you want to delete this document from the knowledge base?
                  <br />
                  <span className="font-semibold break-all text-foreground mt-2 block">
                    {deleteConfirm.id.replace(/^file:/, '')}
                  </span>
                  <br />
                  This will remove all associated section embeddings and connections from the database.
                  The physical markdown file on disk will <span className="font-semibold text-foreground">not</span> be deleted.
                </>
              ) : (
                <>
                  Are you sure you want to remove the connection between these documents?
                  <br />
                  This will delete the link from the knowledge graph database.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={executeDelete}>
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}