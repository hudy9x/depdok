import * as yaml from 'js-yaml';

// Config types
export interface TodoAssignee {
  alias: string;
  name: string;
  avatar?: string;
}

export interface TodoPriority {
  color: string;
  icon?: string;
}

export interface TodoConfig {
  title?: string;
  description?: string;
  assignees?: TodoAssignee[];
  priorities?: {
    high?: TodoPriority;
    medium?: TodoPriority;
    low?: TodoPriority;
  };
  defaults?: {
    priority?: string;
    assignee?: string;
  };
}

// Item types
export interface TodoItemMetadata {
  assignee?: string;
  priority?: 'high' | 'medium' | 'low';
  due?: string;
  tags?: string[];
  completed?: string;
}

export interface TodoItem {
  title: string;
  checked: boolean;
  metadata?: TodoItemMetadata;
}

// Section types
export interface TodoSectionMetadata {
  bg?: string;
  order?: number;
  limit?: number;
}

export interface TodoSection {
  title: string;
  items: TodoItem[];
  metadata?: TodoSectionMetadata;
}

// Document type
export interface TodoDocument {
  config?: TodoConfig;
  sections: TodoSection[];
}

/**
 * Extract YAML frontmatter config from content
 */
function extractConfig(content: string): { config: TodoConfig | null; contentWithoutConfig: string } {
  const yamlMatch = content.match(/^---\n([\s\S]*?)\n---\n/);

  if (!yamlMatch) {
    return { config: null, contentWithoutConfig: content };
  }

  const yamlContent = yamlMatch[1];
  const contentWithoutConfig = content.slice(yamlMatch[0].length);

  try {
    const config = yaml.load(yamlContent) as TodoConfig;
    return { config, contentWithoutConfig };
  } catch (error) {
    console.error('Failed to parse YAML config:', error);
    return { config: null, contentWithoutConfig: content };
  }
}

/**
 * Parse metadata from JSON-like string
 * Example: {key: "value", key2: "value2"}
 */
function parseMetadata(metadataString: string): Record<string, any> {
  try {
    // Convert {key: "value", key2: "value2"} to valid JSON
    const jsonString = metadataString
      .replace(/(\w+):/g, '"$1":')  // Quote keys
      .replace(/'/g, '"');           // Convert single to double quotes
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Failed to parse metadata:', error);
    return {};
  }
}

/**
 * Parse .todo content into TodoDocument structure
 */
export function todoRender(content: string): TodoDocument {
  const { config, contentWithoutConfig } = extractConfig(content);
  const lines = contentWithoutConfig.split('\n');
  const sections: TodoSection[] = [];
  let currentSection: TodoSection | null = null;

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Section header with metadata: # Title {bg: "#color", order: 1}
    const sectionMatch = line.match(/^#\s+(.+?)(?:\s+\{(.+)\})?$/);
    if (sectionMatch) {
      const title = sectionMatch[1].trim();
      const metadataStr = sectionMatch[2];
      const metadata = metadataStr ? parseMetadata(`{${metadataStr}}`) : {};

      currentSection = {
        title,
        items: [],
        metadata: {
          bg: metadata.bg,
          order: metadata.order ? parseInt(metadata.order) : undefined,
          limit: metadata.limit ? parseInt(metadata.limit) : undefined,
        }
      };
      sections.push(currentSection);
      continue;
    }

    // Task item with metadata: [ ] text {assignee: "name", priority: "high"}
    const taskMatch = line.match(/^\[\s*(x|X)?\s*\]\s+(.+?)(?:\s+\{(.+)\})?$/i);
    if (taskMatch) {
      const checked = Boolean(taskMatch[1]);
      const title = taskMatch[2].trim();
      const metadataStr = taskMatch[3];
      const metadata = metadataStr ? parseMetadata(`{${metadataStr}}`) : {};

      if (!currentSection) {
        currentSection = {
          title: "Uncategorized",
          items: [],
          metadata: {}
        };
        sections.push(currentSection);
      }

      currentSection.items.push({
        title,
        checked,
        metadata: {
          assignee: metadata.assignee,
          priority: metadata.priority,
          due: metadata.due,
          tags: metadata.tags,
          completed: metadata.completed,
        }
      });
    }
  }

  return { config: config || undefined, sections };
}

/**
 * Serialize TodoDocument back to .todo format
 */
export function todoSerializer(document: TodoDocument): string {
  let result = '';

  // Serialize config
  if (document.config) {
    result += '---\n';
    result += yaml.dump(document.config);
    result += '---\n\n';
  }

  // Serialize sections
  result += document.sections.map(section => {
    let sectionStr = `# ${section.title}`;

    // Add section metadata
    if (section.metadata && Object.keys(section.metadata).filter(k => section.metadata![k as keyof TodoSectionMetadata] !== undefined).length > 0) {
      const meta: string[] = [];
      if (section.metadata.bg) meta.push(`bg: "${section.metadata.bg}"`);
      if (section.metadata.order !== undefined) meta.push(`order: ${section.metadata.order}`);
      if (section.metadata.limit !== undefined) meta.push(`limit: ${section.metadata.limit}`);
      if (meta.length > 0) {
        sectionStr += ` {${meta.join(', ')}}`;
      }
    }

    // Add items
    const items = section.items.map(item => {
      let itemStr = `[${item.checked ? 'x' : ' '}] ${item.title}`;

      // Add item metadata
      if (item.metadata && Object.keys(item.metadata).filter(k => item.metadata![k as keyof TodoItemMetadata] !== undefined).length > 0) {
        const meta: string[] = [];
        if (item.metadata.assignee) meta.push(`assignee: "${item.metadata.assignee}"`);
        if (item.metadata.priority) meta.push(`priority: "${item.metadata.priority}"`);
        if (item.metadata.due) meta.push(`due: "${item.metadata.due}"`);
        if (item.metadata.tags) meta.push(`tags: ${JSON.stringify(item.metadata.tags)}`);
        if (item.metadata.completed) meta.push(`completed: "${item.metadata.completed}"`);
        if (meta.length > 0) {
          itemStr += ` {${meta.join(', ')}}`;
        }
      }

      return itemStr;
    }).join('\n');

    return `${sectionStr}\n${items}`;
  }).join('\n\n');

  return result;
}
