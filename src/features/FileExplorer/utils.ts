import { FileEntry } from './api';

export interface FlatTreeNode {
  id: string;
  name: string;
  path: string;
  depth: number;
  isFolder: boolean;
  isOpen: boolean;
  parentPath: string | null;
}

/**
 * Flattens a tree structure into a flat array for virtual scrolling
 */
export function flattenTree(
  entries: FileEntry[],
  expandedFolders: Set<string>,
  treeData: Record<string, FileEntry[]>,
  depth: number = 0,
  parentPath: string | null = null
): FlatTreeNode[] {
  const result: FlatTreeNode[] = [];

  for (const entry of entries) {
    const node: FlatTreeNode = {
      id: entry.path,
      name: entry.name,
      path: entry.path,
      depth,
      isFolder: entry.is_dir,
      isOpen: expandedFolders.has(entry.path),
      parentPath,
    };

    result.push(node);

    // If it's a folder and it's expanded, recursively add children from treeData
    if (entry.is_dir && expandedFolders.has(entry.path)) {
      const children = treeData[entry.path];
      if (children) {
        const childNodes = flattenTree(
          children,
          expandedFolders,
          treeData,
          depth + 1,
          entry.path
        );
        result.push(...childNodes);
      }
    }
  }

  return result;
}

/**
 * Finds the index of a node in the flattened tree
 */
export function findNodeIndex(
  flatTree: FlatTreeNode[],
  nodePath: string
): number {
  return flatTree.findIndex((node) => node.path === nodePath);
}
