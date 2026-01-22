import type { Monaco } from '@monaco-editor/react';

export function registerMermaidLanguage(monaco: Monaco) {
  // Register Mermaid language
  monaco.languages.register({ id: 'mermaid' });

  // Define tokenizer (Monarch syntax)
  monaco.languages.setMonarchTokensProvider('mermaid', {
    tokenizer: {
      root: [
        // Comments
        [/%%.*$/, 'comment'],

        // Diagram types
        [/\b(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|stateDiagram-v2|erDiagram|gantt|pie|journey|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment)\b/, 'keyword.diagram'],

        // Directions
        [/\b(TB|TD|BT|RL|LR)\b/, 'keyword.direction'],

        // Block keywords
        [/\b(subgraph|end)\b/, 'keyword.block'],

        // Sequence diagram keywords
        [/\b(participant|actor|activate|deactivate|Note|loop|alt|else|opt|par|and|rect|autonumber|over|left of|right of|create)\b/, 'keyword.sequence'],

        // Class diagram keywords
        [/\b(class|interface|enum|abstract|static|public|private|protected)\b/, 'keyword.class'],

        // State diagram keywords
        [/\b(state|fork|join|choice)\b/, 'keyword.state'],

        // Style keywords
        [/\b(style|classDef|class|fill|stroke|stroke-width|color|linkStyle)\b/, 'keyword.style'],

        // Sequence diagram arrows (specific patterns first for priority)
        [/<<-->>/, 'operator.arrow.sequence'],  // Dotted bidirectional
        [/<<->>/, 'operator.arrow.sequence'],   // Solid bidirectional
        [/-->>/, 'operator.arrow.sequence'],    // Dotted with arrowhead
        [/->>/, 'operator.arrow.sequence'],     // Solid with arrowhead
        [/--x/, 'operator.arrow.sequence'],     // Dotted with cross
        [/-x/, 'operator.arrow.sequence'],      // Solid with cross
        [/--\)/, 'operator.arrow.sequence'],    // Dotted async (open arrow)
        [/-\)/, 'operator.arrow.sequence'],     // Solid async (open arrow)
        [/-->/, 'operator.arrow.sequence'],     // Dotted without arrow
        [/->/, 'operator.arrow.sequence'],      // Solid without arrow

        // Flowchart arrows and connections
        [/o?--+o/, 'operator.arrow'],
        [/x--+x/, 'operator.arrow'],
        [/o--+/, 'operator.arrow'],
        [/--+x/, 'operator.arrow'],
        [/<--+>/, 'operator.arrow'],
        [/<-+>/, 'operator.arrow'],
        [/--+>/, 'operator.arrow'],
        [/-+>/, 'operator.arrow'],
        [/==+>/, 'operator.arrow'],
        [/\.\.+>/, 'operator.arrow'],
        [/--+/, 'operator.arrow'],
        [/==+/, 'operator.arrow'],
        [/\.\.+/, 'operator.arrow'],
        [/-\.-/, 'operator.arrow'],
        [/-\.->/, 'operator.arrow'],

        // Sequence diagram message text (after colon)
        [/:.*$/, 'text.message'],

        // Link text
        [/\|[^|]*\|/, 'string.link'],

        // Strings
        [/"([^"\\]|\\.)*"/, 'string'],
        [/'([^'\\]|\\.)*'/, 'string'],

        // Hex colors
        [/#[0-9a-fA-F]{3,6}\b/, 'constant.color'],

        // Numbers
        [/\b\d+\b/, 'number'],

        // Node shapes and brackets
        [/[\[\]\(\)\{\}]/, 'delimiter.bracket'],
        [/[<>]/, 'delimiter.angle'],

        // Identifiers (node IDs)
        [/\b[A-Z][a-zA-Z0-9_]*\b/, 'type.identifier'],
        [/\b[a-z][a-zA-Z0-9_]*\b/, 'identifier'],
      ],
    },
  });

  // Configure language features
  monaco.languages.setLanguageConfiguration('mermaid', {
    comments: {
      lineComment: '%%',
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  });
}