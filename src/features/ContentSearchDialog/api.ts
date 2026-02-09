import { invoke } from '@tauri-apps/api/core';

export interface ContentSearchResult {
  file_path: string;
  line_number: number;
  line_content: string;
  match_start: number;
  match_end: number;
}

export interface SearchOptions {
  case_sensitive?: boolean;
  max_results?: number;
}

export async function searchContent(
  query: string,
  options?: SearchOptions
): Promise<ContentSearchResult[]> {
  console.log('[ContentSearch API] Calling search_content with:', { query, options });
  try {
    const result = await invoke<ContentSearchResult[]>('search_content', { query, options });
    console.log('[ContentSearch API] Received response:', result);
    console.log('[ContentSearch API] Response length:', result?.length);
    return result;
  } catch (error) {
    console.error('[ContentSearch API] Error:', error);
    throw error;
  }
}

export async function setContentSearchWorkspace(workspacePath: string): Promise<void> {
  console.log('[ContentSearch API] Setting workspace:', workspacePath);
  try {
    await invoke('set_content_search_workspace', { workspacePath });
    console.log('[ContentSearch API] Workspace set successfully');
  } catch (error) {
    console.error('[ContentSearch API] Error setting workspace:', error);
    throw error;
  }
}
