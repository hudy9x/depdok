import type { Monaco } from '@monaco-editor/react';
import { registerMermaidLanguage } from './mermaid-language';
import { registerMermaidThemes } from './mermaid-themes';

export function setupMermaidTheme(monaco: Monaco) {
  registerMermaidLanguage(monaco);
  registerMermaidThemes(monaco);
}

export { registerMermaidLanguage, registerMermaidThemes };
export { formatMermaidCode } from '../monaco-actions/mermaid-formatter';

export const THEME_MAPPING: Record<string, { light: string; dark: string; label: string }> = {
  // VS Code Defaults
  "vs": { light: "vs", dark: "vs-dark", label: "Visual Studio" },

  // Custom Themes Grouped
  "Active4D": { light: "Active4D", dark: "Active4D", label: "Active4D" },
  "All Hallows Eve": { light: "All Hallows Eve", dark: "All Hallows Eve", label: "All Hallows Eve" },
  "Amy": { light: "Amy", dark: "Amy", label: "Amy" },
  "Birds of Paradise": { light: "Birds of Paradise", dark: "Birds of Paradise", label: "Birds of Paradise" },
  "Blackboard": { light: "Blackboard", dark: "Blackboard", label: "Blackboard" },
  "Brilliance": { light: "Brilliance Dull", dark: "Brilliance Black", label: "Brilliance" },
  "Chrome DevTools": { light: "Chrome DevTools", dark: "Chrome DevTools", label: "Chrome DevTools" },
  "Clouds": { light: "Clouds", dark: "Clouds Midnight", label: "Clouds" },
  "Cobalt": { light: "Cobalt", dark: "Cobalt2", label: "Cobalt" },
  "Dawn": { light: "Dawn", dark: "Dawn", label: "Dawn" },
  "Dominion Day": { light: "Dominion Day", dark: "Dominion Day", label: "Dominion Day" },
  "Dracula": { light: "Dracula", dark: "Dracula", label: "Dracula" },
  "Dreamweaver": { light: "Dreamweaver", dark: "Dreamweaver", label: "Dreamweaver" },
  "Eiffel": { light: "Eiffel", dark: "Eiffel", label: "Eiffel" },
  "Espresso Libre": { light: "Espresso Libre", dark: "Espresso Libre", label: "Espresso Libre" },
  "GitHub": { light: "GitHub Light", dark: "GitHub Dark", label: "GitHub" },
  "IDLE": { light: "IDLE", dark: "IDLE", label: "IDLE" },
  "Katzenmilch": { light: "Katzenmilch", dark: "Katzenmilch", label: "Katzenmilch" },
  "Kuroir Theme": { light: "Kuroir Theme", dark: "Kuroir Theme", label: "Kuroir Theme" },
  "LAZY": { light: "LAZY", dark: "LAZY", label: "LAZY" },
  "MagicWB (Amiga)": { light: "MagicWB (Amiga)", dark: "MagicWB (Amiga)", label: "MagicWB (Amiga)" },
  "Merbivore": { light: "Merbivore Soft", dark: "Merbivore", label: "Merbivore" },
  "Monokai": { light: "Monokai Bright", dark: "Monokai", label: "Monokai" },
  "Night Owl": { light: "Night Owl", dark: "Night Owl", label: "Night Owl" },
  "Nord": { light: "Nord", dark: "Nord", label: "Nord" },
  "Oceanic Next": { light: "Oceanic Next", dark: "Oceanic Next", label: "Oceanic Next" },
  "Pastels on Dark": { light: "Pastels on Dark", dark: "Pastels on Dark", label: "Pastels on Dark" },
  "Slush and Poppies": { light: "Slush and Poppies", dark: "Slush and Poppies", label: "Slush and Poppies" },
  "Solarized": { light: "Solarized-light", dark: "Solarized-dark", label: "Solarized" },
  "SpaceCadet": { light: "SpaceCadet", dark: "SpaceCadet", label: "SpaceCadet" },
  "Sunburst": { light: "Upstream Sunburst", dark: "Sunburst", label: "Sunburst" },
  "Textmate (Mac Classic)": { light: "Textmate (Mac Classic)", dark: "Textmate (Mac Classic)", label: "Textmate (Mac Classic)" },
  "Tomorrow": { light: "Tomorrow", dark: "Tomorrow-Night", label: "Tomorrow" },
  "Tomorrow Night Blue": { light: "Tomorrow-Night-Blue", dark: "Tomorrow-Night-Blue", label: "Tomorrow Night Blue" },
  "Tomorrow Night Eighties": { light: "Tomorrow-Night-Eighties", dark: "Tomorrow-Night-Eighties", label: "Tomorrow Night Eighties" },
  "Twilight": { light: "Twilight", dark: "Twilight", label: "Twilight" },
  "Vibrant Ink": { light: "Vibrant Ink", dark: "Vibrant Ink", label: "Vibrant Ink" },
  "Xcode": { light: "Xcode_default", dark: "Xcode_default", label: "Xcode" },
  "Zenburnesque": { light: "Zenburnesque", dark: "Zenburnesque", label: "Zenburnesque" },
  "iPlastic": { light: "iPlastic", dark: "iPlastic", label: "iPlastic" },
  "idleFingers": { light: "idleFingers", dark: "idleFingers", label: "idleFingers" },
  "krTheme": { light: "krTheme", dark: "krTheme", label: "krTheme" },
  "monoindustrial": { light: "monoindustrial", dark: "monoindustrial", label: "monoindustrial" },
};