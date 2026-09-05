import yaml from "js-yaml";

export interface ParsedFrontmatter {
  metadata: Record<string, any> | null;
  rawFrontmatter: string | null;
  body: string;
}

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Extracts YAML frontmatter enclosed between `---` at the top of a Markdown document.
 * Returns the parsed metadata object, the raw YAML string (for exact re-serialization),
 * and the clean Markdown body with the frontmatter stripped out.
 */
export function extractFrontmatter(rawContent: string): ParsedFrontmatter {
  if (!rawContent || !rawContent.startsWith("---")) {
    return {
      metadata: null,
      rawFrontmatter: null,
      body: rawContent || "",
    };
  }

  const match = rawContent.match(FRONTMATTER_REGEX);
  if (!match) {
    return {
      metadata: null,
      rawFrontmatter: null,
      body: rawContent,
    };
  }

  const rawYaml = match[1];
  let metadata: Record<string, any> | null = null;

  try {
    const parsed = yaml.load(rawYaml);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      metadata = parsed as Record<string, any>;
    }
  } catch (err) {
    console.warn("[frontmatter] Failed to parse YAML frontmatter:", err);
  }

  const body = rawContent.slice(match[0].length);

  return {
    metadata,
    rawFrontmatter: rawYaml,
    body,
  };
}

/**
 * Serializes a metadata object into a clean YAML frontmatter string.
 */
export function stringifyFrontmatter(metadata: Record<string, any>): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "";
  }
  try {
    return yaml.dump(metadata, { indent: 2, lineWidth: -1 }).trim();
  } catch (err) {
    console.error("[frontmatter] Failed to stringify YAML:", err);
    return "";
  }
}

/**
 * Prepends the raw frontmatter block back to the markdown body when saving.
 */
export function prependFrontmatter(body: string, rawFrontmatter: string | null): string {
  if (!rawFrontmatter || !rawFrontmatter.trim()) {
    return body;
  }

  const trimmedBody = body.replace(/^\n+/, "");
  return `---\n${rawFrontmatter.trim()}\n---\n\n${trimmedBody}`;
}

/**
 * Strips the YAML frontmatter block (if any) from markdown content.
 */
export function stripFrontmatter(rawContent: string): string {
  return extractFrontmatter(rawContent).body;
}

