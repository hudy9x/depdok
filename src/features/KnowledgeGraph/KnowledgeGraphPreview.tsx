import { useEffect, useMemo, useRef, useState } from 'react';
import Graph from 'graphology';
import circular from 'graphology-layout/circular';
import Sigma from 'sigma';
import { Minus, Plus, RefreshCw, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from "@/components/ui/button";
import { connectDocuments, getProjectGraph, type KnowledgeGraphData } from "@/api-client/knowledge-base";
import { getKnowledgeGraphGroupId } from "@/lib/knowledgeGraph";

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
      x: 0,
      y: 0,
      size: 10,
      color: '#2563eb',
    });
  }

  circular.assign(graph);

  for (const edge of data.edges) {
    if (!graph.hasNode(edge.sourceId) || !graph.hasNode(edge.targetId)) {
      continue;
    }

    graph.addEdgeWithKey(edge.id, edge.sourceId, edge.targetId, {
      label: edge.strength > 1 ? `${edge.edgeType} (${edge.strength})` : edge.edgeType,
      color: '#64748b',
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

  const containerRef = useRef<HTMLDivElement | null>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const selectedSourceNodeRef = useRef<string | null>(null);
  const nodeColorCacheRef = useRef<Map<string, string>>(new Map());
  const isConnectingRef = useRef(false);
  const fileGraphData = useMemo(() => (data ? toFileGraphData(data) : null), [data]);

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

  useEffect(() => {
    if (!fileGraphData || !containerRef.current) {
      return;
    }

    const graph = buildGraph(fileGraphData);
    graphRef.current = graph;
    nodeColorCacheRef.current = new Map(
      graph
        .nodes()
        .map((nodeId) => [nodeId, String(graph.getNodeAttribute(nodeId, 'color') ?? '#2563eb')])
    );

    const renderer = new Sigma(graph, containerRef.current, {
      renderEdgeLabels: true,
      allowInvalidContainer: false,
      labelDensity: 0.09,
      labelGridCellSize: 100,
      labelRenderedSizeThreshold: 8,
      defaultEdgeType: 'arrow',
      defaultDrawNodeLabel: drawFileNodeLabel,
      zIndex: true,
    });

    sigmaRef.current = renderer;
    selectedSourceNodeRef.current = null;

    const highlightNode = (nodeId: string | null) => {
      for (const id of graph.nodes()) {
        const baseColor = nodeColorCacheRef.current.get(id) ?? '#2563eb';
        graph.setNodeAttribute(id, 'color', id === nodeId ? '#f97316' : baseColor);
      }
      renderer.refresh();
    };

    const onClickNode = async ({ node }: { node: string }) => {
      if (isConnectingRef.current) {
        return;
      }

      const source = selectedSourceNodeRef.current;
      if (!source || source === node) {
        selectedSourceNodeRef.current = source === node ? null : node;
        highlightNode(selectedSourceNodeRef.current);
        return;
      }

      isConnectingRef.current = true;
      try {
        const sourceDocumentId = String(graph.getNodeAttribute(source, 'representativeDocumentId') ?? '');
        const targetDocumentId = String(graph.getNodeAttribute(node, 'representativeDocumentId') ?? '');

        if (!sourceDocumentId || !targetDocumentId) {
          throw new Error('Missing representative document id for selected file');
        }

        await connectDocuments(sourceDocumentId, targetDocumentId);

        const fileEdgeKey = `${source}=>${node}`;
        if (!graph.hasEdge(fileEdgeKey)) {
          graph.addEdgeWithKey(fileEdgeKey, source, node, {
            color: '#64748b',
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

        renderer.refresh();
        selectedSourceNodeRef.current = null;
        highlightNode(null);
      } catch (connectError) {
        console.error('[KnowledgeGraphPreview] Failed to connect nodes:', connectError);
        toast.error('Failed to connect documents');
      } finally {
        isConnectingRef.current = false;
      }
    };

    renderer.on('clickNode', onClickNode);

    return () => {
      renderer.removeListener('clickNode', onClickNode);
      renderer.kill();
      sigmaRef.current = null;
      graphRef.current = null;
      selectedSourceNodeRef.current = null;
      nodeColorCacheRef.current.clear();
    };
  }, [fileGraphData]);

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
      <div className="absolute top-3 left-3 z-10 rounded-md border bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur">
        <div className="font-semibold text-foreground">{data?.groupTitle ?? 'Knowledge Graph'}</div>
        <div>{fileGraphData.nodes.length} files, {fileGraphData.edges.length} connections</div>
        <div className="mt-1">Click a node, then another node to connect them.</div>
      </div>

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

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}