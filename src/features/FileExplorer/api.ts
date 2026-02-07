import { invoke } from '@tauri-apps/api/core';

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileEntry[] | null;
}

export async function openFolderDialog(): Promise<string | null> {
  try {
    const result = await invoke<string | null>('open_folder_dialog');
    return result;
  } catch (error) {
    console.error('Failed to open folder dialog:', error);
    return null;
  }
}

export async function listDirectory(path: string): Promise<FileEntry[]> {
  return await invoke('list_dir', { path });
}

export async function readFileContent(path: string): Promise<string> {
  return await invoke('read_file_content', { path });
}

export async function writeFileContent(path: string, content: string): Promise<void> {
  return await invoke('write_file_content', { path, content });
}

export async function createDirectory(path: string): Promise<void> {
  return await invoke('create_directory', { path });
}

export async function createFile(path: string): Promise<void> {
  return await invoke('create_file', { path });
}

export async function deleteNode(path: string): Promise<void> {
  return await invoke('delete_node', { path });
}

export async function renameNode(oldPath: string, newPath: string): Promise<void> {
  return await invoke('rename_node', { oldPath, newPath });
}

export async function copyNode(source: string, destination: string): Promise<void> {
  return await invoke('copy_node', { source, destination });
}

export async function revealFile(path: string): Promise<void> {
  return await invoke('reveal_file', { path });
}
