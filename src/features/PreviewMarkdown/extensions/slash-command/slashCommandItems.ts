import { Editor, Range } from '@tiptap/core';
import {
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  CheckSquare,
  FileCode,
  Table as TableIcon,
  Minus,
  Type,
  Image as ImageIcon,
  GitGraph,
  Workflow,
} from 'lucide-react';
import { RiDoubleQuotesL } from 'react-icons/ri';
import React from 'react';

export type SlashCommandGroup = 'Basic' | 'Lists' | 'Advanced';

export interface SlashCommandItem {
  id: string;
  title: string;
  subtext: string;
  aliases: string[];
  group: SlashCommandGroup;
  icon: React.ComponentType<{ className?: string }>;
  command: (params: { editor: Editor; range: Range }) => void;
}

export const SLASH_COMMAND_ITEMS: SlashCommandItem[] = [
  // Basic group
  {
    id: 'text',
    title: 'Text',
    subtext: 'Just start writing with plain text',
    aliases: ['p', 'paragraph', 'plain', 'text'],
    group: 'Basic',
    icon: Type,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    id: 'heading-1',
    title: 'Heading 1',
    subtext: 'Large section heading',
    aliases: ['h1', 'heading1', 'title', 'large'],
    group: 'Basic',
    icon: Heading1,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
    },
  },
  {
    id: 'heading-2',
    title: 'Heading 2',
    subtext: 'Medium section heading',
    aliases: ['h2', 'heading2', 'subtitle', 'medium'],
    group: 'Basic',
    icon: Heading2,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
    },
  },
  {
    id: 'heading-3',
    title: 'Heading 3',
    subtext: 'Small section heading',
    aliases: ['h3', 'heading3', 'small'],
    group: 'Basic',
    icon: Heading3,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
    },
  },
  {
    id: 'heading-4',
    title: 'Heading 4',
    subtext: 'Extra small sub-heading',
    aliases: ['h4', 'heading4', 'tiny'],
    group: 'Basic',
    icon: Heading4,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 4 }).run();
    },
  },
  {
    id: 'blockquote',
    title: 'Quote',
    subtext: 'Capture a quotation or highlight',
    aliases: ['quote', 'blockquote', 'cite'],
    group: 'Basic',
    icon: RiDoubleQuotesL,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    id: 'code-block',
    title: 'Code Block',
    subtext: 'Syntax highlighted code snippet',
    aliases: ['code', 'codeblock', 'pre', 'snippet', 'syntax'],
    group: 'Basic',
    icon: FileCode,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    id: 'divider',
    title: 'Divider',
    subtext: 'Visually separate sections with a line',
    aliases: ['divider', 'hr', 'line', 'horizontal', 'separator'],
    group: 'Basic',
    icon: Minus,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },

  // Lists group
  {
    id: 'bullet-list',
    title: 'Bullet List',
    subtext: 'Create a simple bulleted list',
    aliases: ['ul', 'bullet', 'list', 'unordered'],
    group: 'Lists',
    icon: List,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    id: 'ordered-list',
    title: 'Numbered List',
    subtext: 'Create an ordered list with numbers',
    aliases: ['ol', 'number', 'numbered', 'ordered'],
    group: 'Lists',
    icon: ListOrdered,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    id: 'task-list',
    title: 'Task List',
    subtext: 'Track tasks with interactive checkboxes',
    aliases: ['todo', 'task', 'checklist', 'checkbox'],
    group: 'Lists',
    icon: CheckSquare,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },

  // Advanced group
  {
    id: 'table',
    title: 'Table',
    subtext: 'Insert a table with headers',
    aliases: ['table', 'grid', 'rows', 'columns'],
    group: 'Advanced',
    icon: TableIcon,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent(
          `
| Heading 1 | Heading 2 |
| --- | --- |
| Content 1 | Content 2 |
`,
          { contentType: 'markdown' }
        )
        .run();
    },
  },
  {
    id: 'mermaid',
    title: 'Mermaid Diagram',
    subtext: 'Render flowcharts, sequence diagrams, and graphs',
    aliases: ['mermaid', 'diagram', 'flowchart', 'graph', 'chart'],
    group: 'Advanced',
    icon: GitGraph,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent(
          '```mermaid\ngraph TD;\n    A[Start] --> B{Decision};\n    B -->|Yes| C[Result 1];\n    B -->|No| D[Result 2];\n```\n',
          { contentType: 'markdown' }
        )
        .run();
    },
  },
  {
    id: 'plantuml',
    title: 'PlantUML Diagram',
    subtext: 'Render UML sequence & component diagrams',
    aliases: ['plantuml', 'uml', 'sequence', 'architecture'],
    group: 'Advanced',
    icon: Workflow,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent(
          '```plantuml\n@startuml\nactor User\nparticipant App\n\nUser -> App: Request\nApp --> User: Response\n@enduml\n```\n',
          { contentType: 'markdown' }
        )
        .run();
    },
  },
  {
    id: 'image',
    title: 'Image',
    subtext: 'Insert markdown image placeholder',
    aliases: ['img', 'image', 'picture', 'photo'],
    group: 'Advanced',
    icon: ImageIcon,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent('![Alt text](image-url)', { contentType: 'markdown' })
        .run();
    },
  },
];

export function getSlashCommandItems(query: string): SlashCommandItem[] {
  const cleanQuery = query.toLowerCase().trim();
  if (!cleanQuery) {
    return SLASH_COMMAND_ITEMS;
  }

  return SLASH_COMMAND_ITEMS.filter((item) => {
    const titleMatch = item.title.toLowerCase().includes(cleanQuery);
    const subtextMatch = item.subtext.toLowerCase().includes(cleanQuery);
    const aliasMatch = item.aliases.some((alias) => alias.toLowerCase().includes(cleanQuery));
    return titleMatch || subtextMatch || aliasMatch;
  });
}
