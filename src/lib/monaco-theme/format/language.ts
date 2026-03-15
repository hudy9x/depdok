import type { Monaco } from '@monaco-editor/react';

/**
 * Register the .format language for Monaco Editor.
 *
 * Uses a Monarch multi-state tokenizer that switches into the correct
 * sub-language (json / xml / yaml / html) inside each fenced block.
 *
 * All emitted token names are STANDARD Monaco token class names so they
 * are automatically colored by every user-selected theme — no custom
 * theme definition required.
 *
 * Standard token → what most themes style it as:
 *   keyword            → blue / purple
 *   string             → orange / green
 *   number             → light-green / teal
 *   comment            → grey / green-grey italic
 *   tag                → blue / teal (HTML/XML element name)
 *   attribute.name     → yellow / light-blue (attribute name)
 *   attribute.value    → orange (attribute value)
 *   delimiter          → plain / subtle
 *   type               → teal / cyan (used for JSON keys)
 */
export function registerFormatLanguage(monaco: Monaco) {
  monaco.languages.register({ id: 'format' });

  monaco.languages.setMonarchTokensProvider('format', {
    defaultToken: 'text',

    tokenizer: {
      // ── Root: between blocks ───────────────────────────────────────────────
      root: [
        [/^~~~json(:.+)?$/,  { token: 'keyword', next: '@json_block' }],
        [/^~~~xml(:.+)?$/,   { token: 'keyword', next: '@xml_block'  }],
        [/^~~~yaml(:.+)?$/, { token: 'keyword', next: '@yaml_block' }],
        [/^~~~html(:.+)?$/, { token: 'keyword', next: '@html_block' }],
        [/^~~~\w+(:.+)?$/,  { token: 'keyword', next: '@plain_block' }],
        [/.+/, 'comment'],   // free text between blocks → comment style
      ],

      // ── JSON block ──────────────────────────────────────────────────────────
      json_block: [
        [/^~~~$/, { token: 'keyword', next: '@pop' }],

        // Keys: "key" followed by optional whitespace then colon
        [/"[^"]*"(?=\s*:)/, 'type'],

        // Strings (values)
        [/"([^"\\]|\\.)*"/, 'string'],

        // Primitives
        [/\b(true|false)\b/, 'keyword'],
        [/\b(null)\b/,       'keyword'],
        [/-?\d+(\.\d+)?([eE][+-]?\d+)?/, 'number'],

        // Structural
        [/[{}\[\]]/, 'delimiter.bracket'],
        [/[:,]/, 'delimiter'],
      ],

      // ── YAML block ──────────────────────────────────────────────────────────
      yaml_block: [
        [/^~~~$/, { token: 'keyword', next: '@pop' }],

        // Key: word followed by colon at start of a line (with optional indent)
        [/^(\s*)([\w\-]+)(\s*:)/, ['', 'type', 'delimiter']],

        // Comments
        [/#.*$/, 'comment'],

        // Strings
        [/'[^']*'/, 'string'],
        [/"[^"]*"/, 'string'],

        // Scalars
        [/\b(true|false|null|~)\b/, 'keyword'],
        [/-?\d+(\.\d+)?/, 'number'],

        // List item
        [/^\s*-\s/, 'delimiter'],
      ],

      // ── XML block ───────────────────────────────────────────────────────────
      xml_block: [
        [/^~~~$/, { token: 'keyword', next: '@pop' }],

        [/<!--/,          { token: 'comment', next: '@xml_comment' }],
        [/<\/[\w.:-]+>/,  'tag'],                                  // </tag> and </ns:tag>
        [/<[\w.:-]+/,     { token: 'tag', next: '@xml_attrs' }],  // <tag and <ns:tag
        [/[^<]+/,         'text'],
      ],
      xml_attrs: [
        [/\/>/,  { token: 'delimiter', next: '@pop' }],  // /> self-close stays delimiter
        [/>/,    { token: 'tag',       next: '@pop' }],   // > closing gets tag color
        [/[\w.:-]+(?=\s*=)/, 'attribute.name'],
        [/"[^"]*"|'[^']*'/, 'attribute.value'],
        [/\s+/, ''],
      ],
      xml_comment: [
        [/-->/, { token: 'comment', next: '@pop' }],
        [/.+/,  'comment'],
      ],

      // ── HTML block ──────────────────────────────────────────────────────────
      html_block: [
        [/^~~~$/, { token: 'keyword', next: '@pop' }],

        [/<!--/,          { token: 'comment', next: '@html_comment' }],
        [/<\/[\w.:-]+>/,  'tag'],                                  // </tag> and </ns:tag>
        [/<[\w.:-]+/,     { token: 'tag', next: '@html_attrs' }],  // <tag and <ns:tag
        [/[^<]+/,         'text'],
      ],
      html_attrs: [
        [/\/>/,  { token: 'delimiter', next: '@pop' }],  // /> self-close
        [/>/,    { token: 'tag',       next: '@pop' }],   // > closing gets tag color
        [/[\w.:-]+(?=\s*=?)/, 'attribute.name'],
        [/"[^"]*"|'[^']*'/, 'attribute.value'],
        [/\s+/, ''],
      ],
      html_comment: [
        [/-->/, { token: 'comment', next: '@pop' }],
        [/.+/,  'comment'],
      ],

      // ── Plain/unknown block ─────────────────────────────────────────────────
      plain_block: [
        [/^~~~$/, { token: 'keyword', next: '@pop' }],
        [/.+/, 'text'],
      ],
    },
  } as any);

  monaco.languages.setLanguageConfiguration('format', {
    brackets: [
      ['{', '}'],
      ['[', ']'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  });
}

/**
 * No-op — kept for backward-compat so existing import in index.ts doesn't break.
 * Token colors are now handled by whatever theme the user has selected.
 */
export function applyFormatTokenColors(_monaco: Monaco) { /* intentionally empty */ }
