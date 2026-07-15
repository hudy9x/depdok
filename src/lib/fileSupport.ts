/** List of supported image file extensions */
export const IMAGE_EXTENSIONS = [
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp'
];

/** Set of supported image file extensions for O(1) lookup */
export const IMAGE_EXTENSIONS_SET = new Set(IMAGE_EXTENSIONS);

/** List of custom preview/rendering file extensions */
export const CUSTOM_PREVIEW_EXTENSIONS = [
  'md', 'txt', 'todo', 'mmd', 'mermaid', 'puml', 'pu', 'plantuml', 'excalidraw', 'npuml', 'nplantuml'
];

/** List of text/code file extensions supported by Monaco Editor */
export const EDITABLE_TEXT_EXTENSIONS = [
  ...CUSTOM_PREVIEW_EXTENSIONS,
  'ts', 'tsx', 'js', 'jsx', 'css', 'py', 'json', 'toml', 'yaml', 'yml', 'rs'
];

/** Set of all text/code file extensions for O(1) lookup */
export const EDITABLE_TEXT_EXTENSIONS_SET = new Set(EDITABLE_TEXT_EXTENSIONS);

/** Set of all supported extensions (either editable text or previewable images) */
export const SUPPORTED_EXTENSIONS_SET = new Set([
  ...EDITABLE_TEXT_EXTENSIONS,
  ...IMAGE_EXTENSIONS
]);

/** Helper to check if a file path or name has an image extension */
export const isImageFile = (filename: string): boolean => {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? IMAGE_EXTENSIONS_SET.has(ext) : false;
};

/** Helper to check if a file path or name is a supported file type */
export const isSupportedFile = (filename: string): boolean => {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? SUPPORTED_EXTENSIONS_SET.has(ext) : false;
};

/** Helper to check if a file path or name is an unsupported file type */
export const isUnsupportedFile = (filename: string): boolean => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext || filename.indexOf('.') === -1) return false;
  return !SUPPORTED_EXTENSIONS_SET.has(ext);
};

/** Helper to check if a file path or name is a binary/non-text file */
export const isBinaryFile = (filename: string): boolean => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext || filename.indexOf('.') === -1) return false;
  return !EDITABLE_TEXT_EXTENSIONS_SET.has(ext);
};
