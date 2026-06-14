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
  return filePath.split(/[/\\]/).slice(0, -1).join('/');
}