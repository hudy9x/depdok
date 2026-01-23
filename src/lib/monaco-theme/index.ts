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
  "vs": { light: "vs", dark: "vs-dark", label: "Visual Studio" },
  "Dracula": { light: "Dracula", dark: "Dracula", label: "Dracula" },
  "Monokai": { light: "Dreamweaver", dark: "Monokai", label: "Monokai" },
  "Night Owl": { light: "Night Owl", dark: "Night Owl", label: "Night Owl" },
  "Solarized": { light: "Solarized-light", dark: "Solarized-dark", label: "Solarized" },
  "Tomorrow": { light: "Tomorrow", dark: "Tomorrow-Night", label: "Tomorrow" },
  "Cobalt": { light: "Cobalt", dark: "Cobalt2", label: "Cobalt" },
  "GitHub": { light: "GitHub Light", dark: "GitHub Dark", label: "GitHub" },
  "Nord": { light: "Nord", dark: "Nord", label: "Nord" },
};