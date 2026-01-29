import { invoke } from '@tauri-apps/api/core';

/**
 * Rename a file or directory
 * @param oldPath - Current path of the file/directory
 * @param newPath - New path for the file/directory
 */
export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  await invoke('rename_node', { oldPath, newPath });
}

/**
 * Create a new directory
 * @param path - Path of the directory to create
 */
export async function createDirectory(path: string): Promise<void> {
  await invoke('create_directory', { path });
}

/**
 * Write binary data to a file
 * @param path - Path of the file to write
 * @param data - Binary data to write
 */
export async function writeBinaryFile(path: string, data: Uint8Array): Promise<void> {
  await invoke('write_binary_file', { path, data: Array.from(data) });
}

/**
 * Delete a file or directory
 * @param path - Path of the file/directory to delete
 */
export async function deleteNode(path: string): Promise<void> {
  await invoke('delete_node', { path });
}

/**
 * Create a new file
 * @param path - Path of the file to create
 */
export async function createFile(path: string): Promise<void> {
  await invoke('create_file', { path });
}
