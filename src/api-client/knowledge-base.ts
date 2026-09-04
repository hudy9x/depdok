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
  projectId: string;
  projectTitle: string;
  groupId?: string;
  groupTitle?: string;
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
  projectIds?: string[];
  groupIds?: string[];
}

export async function upsertDocument({
  id,
  title,
  content,
  projectIds,
  groupIds,
}: UpsertDocumentInput): Promise<string> {
  const ids = projectIds ?? groupIds ?? [];
  return await invoke<string>('insert_or_replace_document', {
    id: id ?? null,
    title,
    content,
    projectIds: ids,
    groupIds: ids,
  });
}

export async function indexMarkdownDocumentSections(
  filePath: string,
  documentTitle: string,
  content: string,
  projectIds?: string[],
  groupIds?: string[]
): Promise<number> {
  const ids = projectIds ?? groupIds ?? [];
  return await invoke<number>('index_markdown_document_sections', {
    filePath,
    documentTitle,
    content,
    projectIds: ids,
    groupIds: ids,
  });
}

export async function setCurrentProject(projectId: string): Promise<void> {
  await invoke('set_current_project', { projectId, groupId: projectId });
}

export const setCurrentProjectGroup = setCurrentProject;

export async function getProjectGraph(projectId: string): Promise<KnowledgeGraphData> {
  return await invoke<KnowledgeGraphData>('get_project_graph', { projectId, groupId: projectId });
}

export async function connectDocuments(
  sourceId: string,
  targetId: string,
  edgeType: string | null = 'related'
): Promise<string> {
  return await invoke<string>('connect_to', { sourceId, targetId, edgeType });
}

export async function deleteDocument(id: string): Promise<void> {
  await invoke('delete_document', { id });
}

export async function deleteConnection(sourceId: string, targetId: string): Promise<void> {
  await invoke('delete_connection', { sourceId, targetId });
}

export interface HybridSearchResult {
  documentId: string;
  title: string;
  content: string;
  score: number;
  matchedChunks: string[];
  lineStart?: number;
}

export async function searchSimilar(query: string, limit = 20): Promise<KnowledgeSearchResult[]> {
  return await invoke<KnowledgeSearchResult[]>('search_similar', { query, limit });
}

export async function searchHybrid(
  query: string,
  limit = 10,
  projectId?: string,
  groupId?: string
): Promise<HybridSearchResult[]> {
  const targetProject = projectId ?? groupId;
  return await invoke<HybridSearchResult[]>('search_hybrid', {
    query,
    limit,
    projectId: targetProject,
    groupId: targetProject,
  });
}

export interface ProjectSummary {
  projectId: string;
  groupId?: string;
  title: string;
  documentCount: number;
}

export type GroupSummary = ProjectSummary;

export async function listProjects(query?: string): Promise<ProjectSummary[]> {
  return await invoke<ProjectSummary[]>('list_projects', { query });
}

export const listGroups = listProjects;

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

export async function getDownloadedModels(): Promise<string[]> {
  return await invoke<string[]>('get_downloaded_models');
}

export async function revealCacheDir(): Promise<void> {
  await invoke('reveal_cache_dir');
}

export async function getModelDownloadSize(modelName: string): Promise<number> {
  return await invoke<number>('get_model_download_size', { modelName });
}

export async function getCacheDir(): Promise<string> {
  return await invoke<string>('get_cache_dir');
}

export async function downloadEmbeddingModel(modelName: string): Promise<void> {
  await invoke('download_embedding_model', { modelName });
}

export async function deleteEmbeddingModel(modelName: string): Promise<void> {
  await invoke('delete_embedding_model', { modelName });
}