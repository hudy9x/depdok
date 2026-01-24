export interface TodoItem {
  title: string;
  checked: boolean;
}

export interface TodoSection {
  title: string;
  items: TodoItem[];
}

export function todoRender(content: string): TodoSection[] {
  const lines = content.split('\n');

  const result: TodoSection[] = [];
  let currentSection: TodoSection | null = null;

  for (let rawLine of lines) {
    const line = rawLine.trim();

    // Ignore empty lines
    if (!line) continue;

    // Heading
    if (line.startsWith('# ')) {
      currentSection = {
        title: line.replace('# ', '').trim(),
        items: []
      };
      result.push(currentSection);
      continue;
    }

    // Task item
    const taskMatch = line.match(/^\[\s*(x|X)?\s*\]\s*(.+)$/i);
    if (taskMatch) {
      const checked = Boolean(taskMatch[1]);
      const title = taskMatch[2].trim();

      // If no section exists effectively, create a default "Uncategorized" section or similar,
      // but based on user prompt, we assume standard format or just skip if no section.
      // Let's support items without a section by checking if currentSection exists.
      if (!currentSection) {
        currentSection = {
          title: "Uncategorized",
          items: []
        };
        result.push(currentSection);
      }

      currentSection.items.push({
        title,
        checked
      });
    }
  }

  return result;
}

export function todoSerializer(sections: TodoSection[]): string {
  return sections.map(section => {
    const header = `# ${section.title}`;
    const items = section.items.map(item => {
      return `[${item.checked ? 'x' : ' '}] ${item.title}`;
    }).join('\n');
    return `${header}\n${items}`;
  }).join('\n\n');
}
