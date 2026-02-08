import { invoke } from '@tauri-apps/api/core';

export interface SearchResult {
  path: string;
  score: number;
  match_indices: number[];
}

export async function indexWorkspaceFiles(workspacePath: string): Promise<number> {
  return await invoke('index_workspace_files', { workspacePath });
}

export async function fuzzySearchFiles(query: string, limit?: number): Promise<SearchResult[]> {
  return await invoke('fuzzy_search_files', { query, limit });
}
