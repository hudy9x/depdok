export type FormatBlockType = "json" | "xml" | "yaml" | "html" | "text";

export interface FormatBlock {
  type: FormatBlockType;
  label?: string;   // optional name after colon, e.g. ~~~json:my-label
  content: string;
  startLine: number; // 1-indexed, line of the opening ~~~type fence
  endLine: number;   // 1-indexed, line of the closing ~~~ fence
}

// Matches ~~~type or ~~~type:label
const FENCE_OPEN_RE = /^~~~(\w+)(?::(.+))?\s*$/;
const FENCE_CLOSE_RE = /^~~~\s*$/;

const SUPPORTED_TYPES: FormatBlockType[] = ["json", "xml", "yaml", "html"];

/**
 * Parse a .format file into a list of FormatBlocks.
 * Fenced blocks start with ~~~<type> or ~~~<type>:<label> and end with ~~~.
 * Text between blocks is emitted as type "text".
 */
export function parseFormatFile(content: string): FormatBlock[] {
  const lines = content.split("\n");
  const blocks: FormatBlock[] = [];

  let i = 0;
  let textStart = 0;
  let textLines: string[] = [];

  const flushText = (endLine: number) => {
    const trimmed = textLines.join("\n").trim();
    if (trimmed) {
      blocks.push({ type: "text", content: trimmed, startLine: textStart + 1, endLine });
    }
    textLines = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    const openMatch = FENCE_OPEN_RE.exec(line);

    if (openMatch) {
      const rawType = openMatch[1].toLowerCase();
      const label = openMatch[2]?.trim() || undefined;
      const type: FormatBlockType = SUPPORTED_TYPES.includes(rawType as FormatBlockType)
        ? (rawType as FormatBlockType)
        : "text";

      const fenceStart = i + 1; // 1-indexed
      flushText(fenceStart - 1);

      i++;
      const contentLines: string[] = [];

      while (i < lines.length && !FENCE_CLOSE_RE.test(lines[i])) {
        contentLines.push(lines[i]);
        i++;
      }

      const fenceEnd = i + 1; // 1-indexed (closing ~~~ line)
      blocks.push({
        type,
        label,
        content: contentLines.join("\n"),
        startLine: fenceStart,
        endLine: fenceEnd,
      });

      textStart = i + 1;
      i++;
      continue;
    }

    textLines.push(line);
    i++;
  }

  flushText(lines.length);
  return blocks;
}

/**
 * Replace the content of a specific block (by index) and return the new full file string.
 * Works by reconstructing lines, preserving fence headers (including labels).
 */
export function replaceBlockContent(
  fileContent: string,
  blocks: FormatBlock[],
  blockIndex: number,
  newBlockContent: string
): string {
  const block = blocks[blockIndex];
  if (!block || block.type === "text") return fileContent;

  const lines = fileContent.split("\n");
  const openFenceLine = block.startLine - 1; // 0-indexed
  const closeFenceLine = block.endLine - 1;  // 0-indexed

  const before = lines.slice(0, openFenceLine + 1);  // includes ~~~type:label
  const after = lines.slice(closeFenceLine);           // includes closing ~~~

  const newLines = newBlockContent
    .split("\n")
    .filter((line, idx, arr) => !(idx === arr.length - 1 && line === ""));

  return [...before, ...newLines, ...after].join("\n");
}

/**
 * Append a new empty block to the file content.
 */
export function appendBlock(fileContent: string, type: FormatBlockType): string {
  const trimmed = fileContent.trimEnd();
  const separator = trimmed.length > 0 ? "\n\n" : "";
  return `${trimmed}${separator}~~~${type}\n\n~~~\n`;
}
