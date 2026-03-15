import type { Monaco } from '@monaco-editor/react';

/**
 * Register a custom Monaco language for .format files.
 * Uses a Monarch tokenizer that:
 *  - detects ~~~json / ~~~xml / ~~~yaml / ~~~html fence openers
 *  - switches state per block type to provide per-language coloring
 *  - colors fence markers, keys, values, tags, etc.
 */
export function registerFormatLanguage(monaco: Monaco) {
  monaco.languages.register({ id: 'format' });

  monaco.languages.setMonarchTokensProvider('format', {
    defaultToken: 'text',
    tokenizer: {
      root: [
        // Opening fences — ~~~json, ~~~json:label, ~~~xml, etc.
        [/^~~~json(:.+)?$/, { token: 'format.fence.json', next: '@json_block' }],
        [/^~~~xml(:.+)?$/,  { token: 'format.fence.xml',  next: '@xml_block' }],
        [/^~~~yaml(:.+)?$/, { token: 'format.fence.yaml', next: '@yaml_block' }],
        [/^~~~html(:.+)?$/, { token: 'format.fence.html', next: '@html_block' }],
        // Unknown fence — treat as plain
        [/^~~~\w+(:.+)?$/, { token: 'format.fence', next: '@plain_block' }],
        // Plain text between blocks
        [/.+/, 'comment'],
      ],

      // ── JSON block ──────────────────────────────────────────────────────────
      json_block: [
        [/^~~~$/, { token: 'format.fence.json', next: '@pop' }],
        [/"[^"]*"\s*(?=:)/, 'format.json.key'],    // keys
        [/:\s*/, 'delimiter'],
        [/"([^"\\]|\\.)*"/, 'format.json.string'],  // string values
        [/\b(true|false)\b/, 'format.json.boolean'],
        [/\b(null)\b/, 'format.json.null'],
        [/-?\d+(\.\d+)?([eE][+-]?\d+)?/, 'format.json.number'],
        [/[{}\[\]]/, 'delimiter.bracket'],
        [/[,]/, 'delimiter'],
      ],

      // ── XML block ───────────────────────────────────────────────────────────
      xml_block: [
        [/^~~~$/, { token: 'format.fence.xml', next: '@pop' }],
        [/<!--/, { token: 'comment', next: '@xml_comment' }],
        [/<\/[a-zA-Z_][\w.-]*>/, 'format.xml.tag'],          // closing tag
        [/<[a-zA-Z_][\w.-]*/, { token: 'format.xml.tag', next: '@xml_attrs' }],
        [/[^<]+/, 'format.xml.text'],
      ],
      xml_attrs: [
        [/>/, { token: 'delimiter', next: '@pop' }],
        [/\/>/, { token: 'delimiter', next: '@pop' }],
        [/[a-zA-Z_][\w.-]*\s*=/, 'format.xml.attr'],
        [/"[^"]*"/, 'format.xml.attr.value'],
        [/'[^']*'/, 'format.xml.attr.value'],
        [/\s+/, ''],
      ],
      xml_comment: [
        [/-->/, { token: 'comment', next: '@pop' }],
        [/.+/, 'comment'],
      ],

      // ── YAML block ──────────────────────────────────────────────────────────
      yaml_block: [
        [/^~~~$/, { token: 'format.fence.yaml', next: '@pop' }],
        [/^(\s*)([\w\-]+)(\s*:)/, ['', 'format.yaml.key', 'delimiter']],
        [/#.*$/, 'comment'],
        [/'[^']*'/, 'format.yaml.string'],
        [/"[^"]*"/, 'format.yaml.string'],
        [/\b(true|false|null|~)\b/, 'format.yaml.boolean'],
        [/-?\d+(\.\d+)?/, 'format.yaml.number'],
        [/- /, 'delimiter'],
      ],

      // ── HTML block ──────────────────────────────────────────────────────────
      html_block: [
        [/^~~~$/, { token: 'format.fence.html', next: '@pop' }],
        [/<!--/, { token: 'comment', next: '@html_comment' }],
        [/<\/[a-zA-Z][\w]*>/, 'format.html.tag'],
        [/<[a-zA-Z][\w]*/, { token: 'format.html.tag', next: '@html_attrs' }],
        [/[^<]+/, 'format.html.text'],
      ],
      html_attrs: [
        [/>/, { token: 'delimiter', next: '@pop' }],
        [/\/>/, { token: 'delimiter', next: '@pop' }],
        [/[a-zA-Z_:][\w:.-]*\s*=?/, 'format.html.attr'],
        [/"[^"]*"/, 'format.html.attr.value'],
        [/'[^']*'/, 'format.html.attr.value'],
        [/\s+/, ''],
      ],
      html_comment: [
        [/-->/, { token: 'comment', next: '@pop' }],
        [/.+/, 'comment'],
      ],

      // ── Plain/unknown block ─────────────────────────────────────────────────
      plain_block: [
        [/^~~~$/, { token: 'format.fence', next: '@pop' }],
        [/.+/, 'text'],
      ],
    },
  } as any);

  monaco.languages.setLanguageConfiguration('format', {
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '<', close: '>' },
    ],
  });
}

/**
 * Apply token colors for the .format language onto the currently active Monaco theme.
 * Call this after the theme is loaded.
 */
export function applyFormatTokenColors(monaco: Monaco) {
  monaco.editor.defineTheme('format-overlay', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      // Fences
      { token: 'format.fence.json', foreground: 'f9c859', fontStyle: 'bold' },
      { token: 'format.fence.xml',  foreground: '4ec9b0', fontStyle: 'bold' },
      { token: 'format.fence.yaml', foreground: 'c792ea', fontStyle: 'bold' },
      { token: 'format.fence.html', foreground: 'f78c6c', fontStyle: 'bold' },
      { token: 'format.fence',      foreground: '999999', fontStyle: 'bold' },

      // JSON
      { token: 'format.json.key',     foreground: '9cdcfe' },
      { token: 'format.json.string',  foreground: 'ce9178' },
      { token: 'format.json.boolean', foreground: '569cd6' },
      { token: 'format.json.null',    foreground: 'e06c75' },
      { token: 'format.json.number',  foreground: 'b5cea8' },

      // XML
      { token: 'format.xml.tag',       foreground: '4ec9b0' },
      { token: 'format.xml.attr',      foreground: '9cdcfe' },
      { token: 'format.xml.attr.value',foreground: 'ce9178' },
      { token: 'format.xml.text',      foreground: 'd4d4d4' },

      // YAML
      { token: 'format.yaml.key',     foreground: '9cdcfe' },
      { token: 'format.yaml.string',  foreground: 'ce9178' },
      { token: 'format.yaml.boolean', foreground: '569cd6' },
      { token: 'format.yaml.number',  foreground: 'b5cea8' },

      // HTML
      { token: 'format.html.tag',       foreground: 'f78c6c' },
      { token: 'format.html.attr',      foreground: '9cdcfe' },
      { token: 'format.html.attr.value',foreground: 'ce9178' },
      { token: 'format.html.text',      foreground: 'd4d4d4' },

      // Comments (text between blocks)
      { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
    ],
    colors: {},
  });
}
