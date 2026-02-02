import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { useMonaco } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { THEME_MAPPING } from "@/lib/monaco-theme";
import { editorThemeAtom } from "@/stores/SettingsStore";

// Helper to determine the actual Monaco theme name based on settings and system theme
export function getMonacoThemeName(themeName: string, systemTheme: string | undefined): string {
  const isDark = systemTheme === "dark";
  let targetTheme = themeName;

  if (THEME_MAPPING[themeName]) {
    targetTheme = isDark ? THEME_MAPPING[themeName].dark : THEME_MAPPING[themeName].light;
  }

  // Create a safe fallback if targetTheme is undefined/null
  if (!targetTheme) {
    return isDark ? "vs-dark" : "vs";
  }

  return targetTheme;
}

export function MonacoThemeLoader({ children }: { children: React.ReactNode }) {
  const monaco = useMonaco();
  const themeName = useAtomValue(editorThemeAtom);
  const { theme: systemTheme } = useTheme();

  useEffect(() => {
    if (!monaco) return;

    const targetTheme = getMonacoThemeName(themeName, systemTheme);
    const isDark = systemTheme === "dark";

    // Handle default VS Code themes natively
    if (targetTheme === 'vs' || targetTheme === 'vs-dark') {
      console.log("Load default theme", targetTheme)
      monaco.editor.setTheme(targetTheme);
      return;
    }

    // Dynamic import
    import(`@/themes/${targetTheme}.json`)
      .then((data) => {
        console.log("Load custom theme", targetTheme)
        monaco.editor.defineTheme(targetTheme, data);
        monaco.editor.setTheme(targetTheme);
      })
      .catch((err) => {
        console.error(`Failed to load theme ${targetTheme}:`, err);
        // Fallback
        monaco.editor.setTheme(isDark ? "vs-dark" : "vs");
      });

  }, [monaco, themeName, systemTheme]);

  return <>{children}</>;
}
