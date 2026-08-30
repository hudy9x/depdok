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
 * Read binary data from a file
 * @param path - Path of the file to read
 * @returns The file content as a Uint8Array
 */
export async function readBinaryFile(path: string): Promise<Uint8Array> {
  const data = await invoke<number[]>('read_binary_file', { path });
  return new Uint8Array(data);
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

/**
 * Read file content as text
 * @param path - Path of the file to read
 * @returns The file content as a string
 */
export async function readFileContent(path: string): Promise<string> {
  return await invoke<string>('read_file_content', { path });
}

/**
 * Write text content to a file
 * @param path - Path of the file to write
 * @param content - Text content to write
 */
export async function writeFileContent(path: string, content: string): Promise<void> {
  await invoke('write_file_content', { path, content });
}

/**
 * Extension-aware file saver.
 * Formats and writes file content appropriately:
 * - .xlsx / .xls: converts Base64 to binary bytes and writes binary
 * - .csv: converts Base64/Workbook (if applicable) to CSV text
 * - other formats: writes as plain UTF-8 text
 */
export async function saveFileContent(path: string, content: string): Promise<void> {
  const ext = path.split('.').pop()?.toLowerCase() || '';

  if (['xlsx', 'xls'].includes(ext)) {
    const { base64ToUint8Array } = await import('@/features/PreviewXlsx/core/xlsxSerializer');
    await writeBinaryFile(path, base64ToUint8Array(content));
    return;
  }

  if (ext === 'csv') {
    let csvText = content;
    const isBase64 =
      content.startsWith('data:') ||
      (/^[A-Za-z0-9+/=\s]+$/.test(content.trim()) &&
        content.length % 4 === 0 &&
        !content.includes('\n'));
    if (isBase64) {
      try {
        const { SpreadsheetSDK } = await import('@/features/PreviewXlsx/core/spreadsheetSdk');
        const wb = await SpreadsheetSDK.loadWorkbook(content);
        csvText = SpreadsheetSDK.toCsv(wb);
      } catch {
        // Fall back to raw content if parsing fails
      }
    }
    await writeFileContent(path, csvText);
    return;
  }

  await writeFileContent(path, content);
}

/**
 * Export markdown content to an HTML file
 * @param markdown - The markdown content
 * @param filePath - The original markdown file path (if any)
 * @returns The path of the exported HTML file
 */
export async function exportMarkdownToHtml(markdown: string, filePath?: string): Promise<string> {
  return await invoke<string>('export_markdown_to_html', { markdown, filePath: filePath || null });
}

/**
 * Export markdown content to a PDF file
 * @param markdown - The markdown content
 * @param filePath - The original markdown file path (if any)
 * @returns The path of the exported PDF file
 */
export async function exportMarkdownToPdf(markdown: string, filePath?: string): Promise<string> {
  return await invoke<string>('export_markdown_to_pdf', { markdown, filePath: filePath || null });
}

/**
 * Reveal a file in Finder/Explorer
 * @param path - Path to reveal
 */
export async function revealFile(path: string): Promise<void> {
  await invoke('reveal_file', { path });
}
