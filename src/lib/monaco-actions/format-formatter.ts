import * as yaml from "js-yaml";
import { parseFormatFile, FormatBlockType } from "../format-parser";

/**
 * Format a single block's content based on its type.
 * Returns the formatted string, or the original if formatting fails.
 */
export function formatBlock(type: FormatBlockType, content: string): string {
  try {
    switch (type) {
      case "json":
        return formatJson(content);
      case "xml":
        return formatXml(content);
      case "yaml":
        return formatYaml(content);
      case "html":
        return formatHtml(content);
      default:
        return content;
    }
  } catch {
    // Return original if formatting fails
    return content;
  }
}

function formatJson(content: string): string {
  const parsed = JSON.parse(content.trim());
  return JSON.stringify(parsed, null, 2);
}

function formatYaml(content: string): string {
  const parsed = yaml.load(content.trim());
  return yaml.dump(parsed, { indent: 2, lineWidth: -1 });
}

function formatXml(content: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content.trim(), "application/xml");
  const errorNode = doc.querySelector("parsererror");
  if (errorNode) throw new Error("Invalid XML");
  return serializeXml(doc.documentElement, 0);
}

function formatHtml(content: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content.trim(), "text/html");
  return serializeXml(doc.body, 0).trim();
}

function serializeXml(node: Element | ChildNode, depth: number): string {
  const indent = "  ".repeat(depth);

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim() ?? "";
    return text ? `${indent}${text}\n` : "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node as Element;
  const tagName = el.tagName;
  const attrs = Array.from(el.attributes)
    .map((a) => ` ${a.name}="${a.value}"`)
    .join("");

  const children = Array.from(el.childNodes);
  const hasChildren = children.some(
    (c) =>
      c.nodeType === Node.ELEMENT_NODE ||
      (c.nodeType === Node.TEXT_NODE && c.textContent?.trim())
  );

  if (!hasChildren) {
    const text = el.textContent?.trim() ?? "";
    if (text) return `${indent}<${tagName}${attrs}>${text}</${tagName}>\n`;
    return `${indent}<${tagName}${attrs} />\n`;
  }

  const inner = children.map((c) => serializeXml(c, depth + 1)).join("");
  return `${indent}<${tagName}${attrs}>\n${inner}${indent}</${tagName}>\n`;
}

/**
 * Format the block under the cursor in a .format file.
 * Returns the full updated file content, or null if no block is under cursor.
 */
export function formatBlockAtLine(
  fileContent: string,
  cursorLine: number // 1-indexed
): string | null {
  const blocks = parseFormatFile(fileContent);
  const lines = fileContent.split("\n");

  // Find the block that contains the cursor line
  const block = blocks.find(
    (b) => b.type !== "text" && cursorLine >= b.startLine && cursorLine <= b.endLine
  );

  if (!block) return null;

  const formatted = formatBlock(block.type, block.content);

  // Replace lines from startLine to endLine-1 (content lines, excluding fences)
  // startLine points to ~~~type, endLine points to ~~~
  // Content lines are startLine to endLine-2 (0-indexed: startLine to endLine-2)
  const openFenceLine = block.startLine - 1; // 0-indexed index of ~~~type
  const closeFenceLine = block.endLine - 1;  // 0-indexed index of closing ~~~

  const before = lines.slice(0, openFenceLine + 1);        // includes ~~~type
  const after = lines.slice(closeFenceLine);                // includes closing ~~~
  const newContent = [...before, ...formatted.split("\n").filter((_, i, arr) => {
    // Trim trailing empty line that yaml.dump adds
    if (i === arr.length - 1 && arr[i] === "") return false;
    return true;
  }), ...after];

  return newContent.join("\n");
}
