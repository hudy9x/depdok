import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { useMonaco } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { THEME_MAPPING } from "@/lib/monaco-theme";
import { editorThemeAtom } from "@/stores/SettingsStore";

export function MonacoThemeLoader({ children }: { children: React.ReactNode }) {
  const monaco = useMonaco();
  const themeName = useAtomValue(editorThemeAtom);
  const { theme: systemTheme } = useTheme();

  useEffect(() => {
    if (!monaco) return;

    const loadTheme = (name: string) => {
      // Determine the actual theme file/name to load based on system preference
      const isDark = systemTheme === "dark";
      let targetTheme = name;

      if (THEME_MAPPING[name]) {
        targetTheme = isDark ? THEME_MAPPING[name].dark : THEME_MAPPING[name].light;
      }

      // Handle default VS Code themes natively
      if (targetTheme === 'vs' || targetTheme === 'vs-dark') {
        monaco.editor.setTheme(targetTheme);
        return;
      }

      // Dynamic import
      import(`@/themes/${targetTheme}.json`)
        .then((data) => {
          monaco.editor.defineTheme(targetTheme, data);
          monaco.editor.setTheme(targetTheme);
        })
        .catch((err) => {
          console.error(`Failed to load theme ${targetTheme}:`, err);
          // Fallback
          monaco.editor.setTheme(isDark ? "vs-dark" : "vs");
        });
    };

    loadTheme(themeName);

  }, [monaco, themeName, systemTheme]);

  return <>{children}</>;
}
