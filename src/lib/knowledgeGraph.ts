import { platform } from '@tauri-apps/plugin-os';

export const KNOWLEDGE_GRAPH_FILE_NAME = 'knowledge-graph.md';

export function isKnowledgeGraphFile(filePath: string | null | undefined): boolean {
  if (!filePath) return false;
  const fileName = filePath.split(/[/\\]/).pop()?.toLowerCase();
  return fileName === KNOWLEDGE_GRAPH_FILE_NAME;
}

export function buildKnowledgeGraphFilePath(workspaceRoot: string): string {
  return `${workspaceRoot}/${KNOWLEDGE_GRAPH_FILE_NAME}`;
}

export function getKnowledgeGraphGroupId(filePath: string): string {
  // Use the OS separator so the returned group ID matches the raw
  // workspaceRoot stored in the database (e.g. D:\project on Windows).
  const separator = platform() === 'windows' ? '\\' : '/';
  return filePath.split(/[/\\]/).slice(0, -1).join(separator);
}