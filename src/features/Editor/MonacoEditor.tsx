import { useState, useRef, useEffect } from "react";
import MonacoEditorReact, { BeforeMount, OnMount } from "@monaco-editor/react";
import { useAtomValue } from "jotai";

import { useTheme } from "next-themes";

import { MonacoThemeLoader, getMonacoThemeName } from "./MonacoThemeLoader";

import { editorThemeAtom } from "@/stores/SettingsStore";
import { setupMermaidTheme } from '@/lib/monaco-theme';
import { setupPlantUMLTheme } from '@/lib/monaco-theme';
import { useAutoSave } from "./useAutoSave";
import {
  registerFormatAction,
  registerDuplicateLineAction,
  registerToggleTodoAction
} from '@/lib/monaco-actions';
import { registerTodoSnippets, registerDateSnippets } from '@/lib/monaco-snippets';


interface MonacoEditorProps {
  initialContent: string;
  language: string;
  onContentChange?: (content: string) => void;
}

export function MonacoEditor({ initialContent, language, onContentChange }: MonacoEditorProps) {
  const [content, setContent] = useState(initialContent);

  // Theme logic
  // Theme logic
  const themeName = useAtomValue(editorThemeAtom);
  const { theme: systemTheme } = useTheme();

  // Calculate theme synchronously for initial render
  let currentTheme = getMonacoThemeName(themeName, systemTheme);



  const { handleContentChange } = useAutoSave();

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  // Sync content when initialContent changes
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const handleChange = (value: string | undefined) => {
    if (value === undefined) return;

    setContent(value);
    onContentChange?.(value); // Notify parent
    handleContentChange(value); // Save draft and update dirty state
  };

  const handleBeforeMount: BeforeMount = (monaco) => {
    monacoRef.current = monaco;

    setTimeout(() => {
      setupMermaidTheme(monaco);
      setupPlantUMLTheme(monaco);

      // Register snippets
      if (language === 'markdown') {
        registerTodoSnippets(monaco, language);
        registerDateSnippets(monaco, language);
      }

    }, 500);

  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Action registration - Start ==================
    if (language === 'mermaid') {
      // 1. Auto format on Shift+Alt+F
      const handleFormat = (formattedCode: string) => {
        setContent(formattedCode);
      };

      registerFormatAction(editor, monaco, handleFormat);
    }

    // 2. Duplicate line on Shift+Alt+D
    registerDuplicateLineAction(editor, monaco);

    // 3. Toggle todo checkbox on Shift+Alt+X
    registerToggleTodoAction(editor, monaco);

    // Action registration - End ==================

  };

  return (
    <div className="w-full h-full">
      <MonacoThemeLoader>
        <MonacoEditorReact
          value={content}
          language={language}
          loading=""
          theme={currentTheme}
          onChange={handleChange}
          beforeMount={handleBeforeMount}
          onMount={handleEditorDidMount}
          options={{
            fontSize: 12,
            fontFamily: "Monaco, Menlo, 'Courier New', monospace",
            lineNumbers: "on",
            minimap: { enabled: true },
            wordWrap: "on",
            automaticLayout: true,
            scrollBeyondLastLine: false,
            padding: { top: 16, bottom: 16 },
          }}
        />
      </MonacoThemeLoader>
    </div>
  );
}
