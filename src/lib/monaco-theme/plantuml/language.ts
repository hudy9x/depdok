import type { Monaco } from '@monaco-editor/react';

export function registerPlantUMLLanguage(monaco: Monaco) {
  // Register PlantUML language
  monaco.languages.register({ id: 'plantuml' });

  // Define tokenizer (Monarch syntax)
  monaco.languages.setMonarchTokensProvider('plantuml', {
    tokenizer: {
      root: [
        // Comments (single line ' and block /' '/ )
        // Comments (single line ' and block /' '/ )
        [/^\s*'.*$/, 'comment'],
        // [/\/'/, 'comment', '@comment_block'],

        // Preprocessor
        [/[\@]startuml/, 'keyword'],
        [/[\@]enduml/, 'keyword'],
        [/!include/, 'keyword'],
        [/!define/, 'keyword'],

        // Keywords
        [/\b(actor|agent|artifact|boundary|card|class|cloud|component|control|database|entity|file|folder|frame|interface|node|package|participant|queue|rectangle|stack|storage|usecase|use)\b/, 'keyword'],
        [/\b(as|also|of|on|is)\b/, 'keyword'],
        [/\b(note|left|right|top|bottom|over|floating)\b/, 'keyword'],
        [/\b(title|header|footer|legend|caption)\b/, 'keyword'],
        [/\b(skinparam|hide|show)\b/, 'keyword'],
        [/\b(autonumber|newpage|box|alt|else|opt|loop|par|break|critical|group|end)\b/, 'keyword'],

        // Arrows (Map to 'type' to ensure visibility and differentiation from keywords)
        [/o<->o/, 'type'],
        [/x<->x/, 'type'],
        [/o->o/, 'type'],
        [/->>o/, 'type'],
        [/-\/\/o/, 'type'],
        [/-\\\\o/, 'type'],
        [/x->o/, 'type'],

        [/->>/, 'type'],
        [/-\/\//, 'type'],
        [/->x/, 'type'],
        [/x->/, 'type'],
        [/o->/, 'type'],
        [/->o/, 'type'],
        [/<->/, 'type'],
        [/-\\\\/, 'type'],
        [/-\/o/, 'type'],
        [/-\\o/, 'type'],

        [/->/, 'type'],
        [/-\\/, 'type'],
        [/-\//, 'type'],

        // Message text (colon + remainder)
        [/(:)(.*$)/, ['delimiter', 'string']],

        // Colors
        [/#[0-9a-fA-F]{6}/, 'constant'],
        [/#[0-9a-fA-F]{3}/, 'constant'],
        [/\b(AliceBlue|AntiqueWhite|Aqua|Aquamarine|Azure|Beige|Bisque|Black|BlanchedAlmond|Blue|BlueViolet|Brown|BurlyWood|CadetBlue|Chartreuse|Chocolate|Coral|CornflowerBlue|Cornsilk|Crimson|Cyan|DarkBlue|DarkCyan|DarkGoldenRod|DarkGray|DarkGreen|DarkGrey|DarkKhaki|DarkMagenta|DarkOliveGreen|DarkOrange|DarkOrchid|DarkRed|DarkSalmon|DarkSeaGreen|DarkSlateBlue|DarkSlateGray|DarkSlateGrey|DarkTurquoise|DarkViolet|DeepPink|DeepSkyBlue|DimGray|DimGrey|DodgerBlue|FireBrick|FloralWhite|ForestGreen|Fuchsia|Gainsboro|GhostWhite|Gold|GoldenRod|Gray|Green|GreenYellow|Grey|HoneyDew|HotPink|IndianRed|Indigo|Ivory|Khaki|Lavender|LavenderBlush|LawnGreen|LemonChiffon|LightBlue|LightCoral|LightCyan|LightGoldenRodYellow|LightGray|LightGreen|LightGrey|LightPink|LightSalmon|LightSeaGreen|LightSkyBlue|LightSlateGray|LightSlateGrey|LightSteelBlue|LightYellow|Lime|LimeGreen|Linen|Magenta|Maroon|MediumAquaMarine|MediumBlue|MediumOrchid|MediumPurple|MediumSeaGreen|MediumSlateBlue|MediumSpringGreen|MediumTurquoise|MediumVioletRed|MidnightBlue|MintCream|MistyRose|Moccasin|NavajoWhite|Navy|OldLace|Olive|OliveDrab|Orange|OrangeRed|Orchid|PaleGoldenRod|PaleGreen|PaleTurquoise|PaleVioletRed|PapayaWhip|PeachPuff|Peru|Pink|Plum|PowderBlue|Purple|Red|RosyBrown|RoyalBlue|SaddleBrown|Salmon|SandyBrown|SeaGreen|SeaShell|Sienna|Silver|SkyBlue|SlateBlue|SlateGray|SlateGrey|Snow|SpringGreen|SteelBlue|Tan|Teal|Thistle|Tomato|Turquoise|Violet|Wheat|White|WhiteSmoke|Yellow|YellowGreen)\b/, 'constant'],

        // Strings
        [/"([^"\\]|\\.)*"/, 'string'],

        // Identifiers (Participants/Variables)
        [/\b[a-zA-Z_][a-zA-Z0-9_]*\b/, 'entity'],
      ],

      comment: [
        [/[^']+/, 'comment'],
        [/'/, 'comment', '@pop']
      ],

      comment_block: [
        [/[^\/]+/, 'comment'],
        [/\/'/, 'comment', '@push'], // nested comments?
        [/'\//, 'comment', '@pop'],
        [/[\/']/, 'comment']
      ]
    },
  });

  // Configure language features
  monaco.languages.setLanguageConfiguration('plantuml', {
    comments: {
      lineComment: "'",
      blockComment: ["/'", "'/"]
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
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
    ],
  });
}
