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
  try {
    const result = await invoke<FileEntry[]>('list_dir', { path });
    return result;
  } catch (error) {
    console.error('Failed to list directory:', error);
    throw error;
  }
}

export async function createFile(path: string): Promise<void> {
  await invoke('create_file', { path });
}

export async function createFolder(path: string): Promise<void> {
  await invoke('create_directory', { path });
}

export async function deleteNode(path: string): Promise<void> {
  await invoke('delete_node', { path });
}

export async function renameNode(oldPath: string, newPath: string): Promise<void> {
  await invoke('rename_node', { oldPath, newPath });
}
