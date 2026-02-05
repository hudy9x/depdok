import { useState, useRef, useEffect, useCallback } from "react";
import MonacoEditorReact, { BeforeMount, OnMount } from "@monaco-editor/react";
import { listen } from '@tauri-apps/api/event';
import { useAtomValue } from "jotai";

import { useTheme } from "next-themes";

import { MonacoThemeLoader, getMonacoThemeName } from "./MonacoThemeLoader";

import { editorThemeAtom } from "@/stores/SettingsStore";
import { setupMermaidTheme } from '@/lib/monaco-theme';
import { setupPlantUMLTheme } from '@/lib/monaco-theme';
import { useAutoSave } from "./useAutoSave";
import { useFileWatcher } from "@/hooks/useFileWatcher";
import { editorStateAtom } from "@/stores/EditorStore";
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
  const editorState = useAtomValue(editorStateAtom);

  // Theme logic
  // Theme logic
  const themeName = useAtomValue(editorThemeAtom);
  const { theme: systemTheme } = useTheme();

  // Calculate theme synchronously for initial render
  let currentTheme = getMonacoThemeName(themeName, systemTheme);



  const { handleContentChange } = useAutoSave();

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const menuListenersCleanupRef = useRef<(() => void) | null>(null);

  // Sync content when initialContent changes
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  // File watcher hook - reloads content when file changes externally
  const handleContentReload = useCallback((newContent: string) => {
    setContent(newContent);
    onContentChange?.(newContent);
  }, []);

  useFileWatcher({
    filePath: editorState.filePath || "",
    onContentReload: handleContentReload,
  });

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

    // Setup menu event listeners
    const unlisteners: Promise<() => void>[] = [];

    const register = (event: string, action: string) => {
      unlisteners.push(listen(event, () => {
        editor.trigger('menu', action, {});
        editor.focus(); // Ensure editor has focus
      }));
    }

    register('menu://selection/select-all', 'editor.action.selectAll');
    register('menu://selection/expand', 'editor.action.smartSelect.expand');
    register('menu://selection/shrink', 'editor.action.smartSelect.shrink');
    register('menu://selection/copy-line-up', 'editor.action.copyLinesUpAction');
    register('menu://selection/copy-line-down', 'editor.action.copyLinesDownAction');
    register('menu://selection/move-line-up', 'editor.action.moveLinesUpAction');
    register('menu://selection/move-line-down', 'editor.action.moveLinesDownAction');
    register('menu://selection/duplicate', 'editor.action.duplicateSelection');
    register('menu://selection/add-cursor-above', 'editor.action.insertCursorAbove');
    register('menu://selection/add-cursor-below', 'editor.action.insertCursorBelow');
    register('menu://selection/add-cursors-to-line-ends', 'editor.action.insertCursorAtEndOfEachLineSelected');
    register('menu://selection/add-next-occurrence', 'editor.action.addSelectionToNextFindMatch');
    register('menu://selection/add-previous-occurrence', 'editor.action.addSelectionToPreviousFindMatch');
    register('menu://selection/select-all-occurrences', 'editor.action.selectHighlights');
    register('menu://selection/column-selection-mode', 'editor.action.toggleColumnSelection');

    // Store cleanup function
    menuListenersCleanupRef.current = () => {
      unlisteners.forEach(p => p.then(u => u()));
    };
  };

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      menuListenersCleanupRef.current?.();
    };
  }, []);

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
