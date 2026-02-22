import { useCallback } from "react";
import { Editor } from "@tiptap/react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

const PLACEHOLDER_TEXT = '⏳ Uploading...';
const MIN_PLACEHOLDER_MS = 300;
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

interface UploadContext {
  filePath: string;
  assetsFolder: string;
}

/** Saves a file to disk and returns the relative markdown path. */
async function saveImageFile(file: File, ctx: UploadContext): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const dataArray = Array.from(new Uint8Array(arrayBuffer));

  const timestamp = Date.now();
  const ext = file.name.split('.').pop() || 'png';
  const filename = `image-${timestamp}.${ext}`;

  const dir = ctx.filePath.substring(0, ctx.filePath.lastIndexOf('/'));
  let targetDir = dir;
  let relativePath = `./${filename}`;

  if (ctx.assetsFolder) {
    targetDir = `${dir}/${ctx.assetsFolder}`;
    relativePath = `./${ctx.assetsFolder}/${filename}`;
    try {
      await invoke('create_directory', { path: targetDir });
    } catch {
      // Directory may already exist — continue
    }
  }

  await invoke('write_binary_file', {
    path: `${targetDir}/${filename}`,
    data: dataArray,
  });

  return relativePath;
}

/** Replaces the placeholder paragraph with the final markdown image syntax. */
function replacePlaceholder(editor: Editor, file: File, relativePath: string) {
  const { state } = editor;
  let foundPos = -1;
  let nodeSize = 0;

  state.doc.descendants((node, pos) => {
    if (node.textContent === PLACEHOLDER_TEXT) {
      foundPos = pos;
      nodeSize = node.nodeSize;
      return false;
    }
  });

  if (foundPos !== -1) {
    editor.commands.insertContentAt(
      { from: foundPos, to: foundPos + nodeSize },
      `![${file.name}](${relativePath})`,
      { contentType: 'markdown' }
    );
    editor.commands.focus();
  }
}

/** Inserts the uploading placeholder at the given position. */
function insertPlaceholder(editor: Editor, pos: number) {
  editor
    .chain()
    .insertContentAt(pos, {
      type: 'paragraph',
      content: [{ type: 'text', text: PLACEHOLDER_TEXT }],
    })
    .run();
}

/** Uploads a single image file with a placeholder while in-flight. */
async function uploadFile(editor: Editor, file: File, insertPos: number, ctx: UploadContext) {
  insertPlaceholder(editor, insertPos);
  const startTime = Date.now();

  try {
    const relativePath = await saveImageFile(file, ctx);
    const delay = Math.max(0, MIN_PLACEHOLDER_MS - (Date.now() - startTime));
    setTimeout(() => replacePlaceholder(editor, file, relativePath), delay);
  } catch (error) {
    toast.error(`Failed to upload image: ${error}`);
    // Remove the placeholder on error
    const cleaned = editor.getMarkdown().replace(PLACEHOLDER_TEXT, '');
    editor.commands.setContent(cleaned, { contentType: 'markdown' });
  }
}

/**
 * Returns FileHandler-compatible onDrop / onPaste callbacks.
 * Pass currentFilePath and a getter for the assets folder name.
 */
export function useFileHandler(
  currentFilePath: string | null,
  getAssetsFolder: () => string
) {
  const buildContext = useCallback((): UploadContext | null => {
    if (!currentFilePath) return null;
    return { filePath: currentFilePath, assetsFolder: getAssetsFolder() };
  }, [currentFilePath, getAssetsFolder]);

  const onDrop = useCallback(
    (editor: Editor, files: File[], pos: number) => {
      const ctx = buildContext();
      if (!ctx) return;
      files.forEach((file, i) => uploadFile(editor, file, pos + i, ctx));
    },
    [buildContext]
  );

  const onPaste = useCallback(
    (editor: Editor, files: File[], htmlContent: string | undefined): boolean => {
      if (htmlContent) return false;
      if (files.length === 0) return false;
      const ctx = buildContext();
      if (!ctx) return false;
      const pos = editor.state.selection.anchor;
      files.forEach((file) => uploadFile(editor, file, pos, ctx));
      return true;
    },
    [buildContext]
  );

  return { allowedMimeTypes: ALLOWED_MIME_TYPES, onDrop, onPaste };
}
