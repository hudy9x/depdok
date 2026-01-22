import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { useMonaco } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { editorThemeAtom } from "@/stores/SettingsStore";

export function MonacoThemeLoader({ children }: { children: React.ReactNode }) {
  const monaco = useMonaco();
  const themeName = useAtomValue(editorThemeAtom);
  const { theme: systemTheme } = useTheme();

  useEffect(() => {
    if (!monaco) return;

    const loadTheme = (name: string) => {
      // Handle default VS Code themes natively
      if (name === 'vs' || name === 'vs-dark') {
        monaco.editor.setTheme(name);
        return;
      }

      // Handle 'system' or other mapped logic preference if needed, 
      // but for now we assume editorThemeAtom holds the direct filename/key.

      // Dynamic import
      import(`@/themes/${name}.json`)
        .then((data) => {
          monaco.editor.defineTheme(name, data);
          monaco.editor.setTheme(name);
        })
        .catch((err) => {
          console.error(`Failed to load theme ${name}:`, err);
          // Fallback based on system theme logic
          const isDark = systemTheme === "dark";
          monaco.editor.setTheme(isDark ? "vs-dark" : "vs");
        });
    };

    loadTheme(themeName);

  }, [monaco, themeName, systemTheme]);

  return <>{children}</>;
}
