import { invoke } from '@tauri-apps/api/core';

export interface KnowledgeGraphDocument {
  id: string;
  title: string;
  content: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: string | null;
}

export interface KnowledgeGraphData {
  groupId: string;
  groupTitle: string;
  documents: KnowledgeGraphDocument[];
  edges: KnowledgeGraphEdge[];
}

export interface KnowledgeSearchResult {
  id: string;
  title: string;
  distance: number;
}

export interface UpsertDocumentInput {
  id?: string;
  title: string;
  content: string;
  groupIds: string[];
}

export async function upsertDocument({
  id,
  title,
  content,
  groupIds,
}: UpsertDocumentInput): Promise<string> {
  return await invoke<string>('insert_or_replace_document', {
    id: id ?? null,
    title,
    content,
    groupIds,
  });
}

export async function indexMarkdownDocumentSections(
  filePath: string,
  documentTitle: string,
  content: string,
  groupIds: string[]
): Promise<number> {
  return await invoke<number>('index_markdown_document_sections', {
    filePath,
    documentTitle,
    content,
    groupIds,
  });
}

export async function setCurrentProjectGroup(groupId: string): Promise<void> {
  await invoke('set_current_project_group', { groupId });
}

export async function getProjectGraph(groupId: string): Promise<KnowledgeGraphData> {
  return await invoke<KnowledgeGraphData>('get_project_graph', { groupId });
}

export async function connectDocuments(
  sourceId: string,
  targetId: string,
  edgeType: string | null = 'related'
): Promise<string> {
  return await invoke<string>('connect_to', { sourceId, targetId, edgeType });
}

export async function searchSimilar(query: string, limit = 20): Promise<KnowledgeSearchResult[]> {
  return await invoke<KnowledgeSearchResult[]>('search_similar', { query, limit });
}

export async function rebuildAllEdges(): Promise<void> {
  await invoke('rebuild_all_edges');
}

export interface CurrentModelStatus {
  modelType: 'local' | 'remote';
  modelName: string;
  openaiKey?: string;
  isDownloaded: boolean;
}

export async function getCurrentEmbeddingModel(): Promise<CurrentModelStatus> {
  return await invoke<CurrentModelStatus>('get_current_embedding_model');
}

export async function updateEmbeddingModelAndReindex(
  modelType: string,
  modelName: string,
  openaiKey?: string,
  workspaceRoot?: string
): Promise<number> {
  return await invoke<number>('update_embedding_model_and_reindex', {
    modelType,
    modelName,
    openaiKey: openaiKey || null,
    workspaceRoot: workspaceRoot || '',
  });
}