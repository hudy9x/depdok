import { useState, useRef, useEffect, useCallback } from "react";
import MonacoEditorReact, { BeforeMount, OnMount } from "@monaco-editor/react";
import { listen } from '@tauri-apps/api/event';
import { useAtomValue, useAtom } from "jotai";
import { useTheme } from "next-themes";

import { MonacoThemeLoader, getMonacoThemeName } from "./MonacoThemeLoader";

import { editorThemeAtom } from "@/stores/SettingsStore";
import { setupMermaidTheme, setupPlantUMLTheme } from '@/lib/monaco-theme';
import { useAutoSave } from "./useAutoSave";
import { useFileWatcher } from "@/hooks/useFileWatcher";
import { useLineJump } from "./useLineJump";
import { configureMonacoLanguages } from "./configureMonacoLanguages";
import {
  registerFormatAction,
  registerDuplicateLineAction,
  registerToggleTodoAction,
} from '@/lib/monaco-actions';
import { registerTodoSnippets, registerDateSnippets } from '@/lib/monaco-snippets';
import { plantUMLJumpAtom } from "@/features/PreviewPlantUML/store";


interface MonacoEditorProps {
  initialContent: string;
  language: string;
  onContentChange?: (content: string) => void;
  enableFileWatcher?: boolean; // Enable file watcher to detect external changes
  lineNumber?: number; // Optional line number to jump to when opening
  filePath: string;
  tabId: string;
  isDeleted?: boolean;
  /** Whether this tab is currently visible. Used to trigger layout() after display:none→block. */
  isTabActive?: boolean;
}

export function MonacoEditor({
  initialContent,
  language,
  onContentChange,
  enableFileWatcher = false,
  lineNumber,
  filePath,
  tabId,
  isDeleted,
  isTabActive = true,
}: MonacoEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [plantUMLJump, setPlantUMLJump] = useAtom(plantUMLJumpAtom);


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
    const currentEditorValue = editorRef.current?.getValue();
    if (currentEditorValue === initialContent) return;
    setContent(initialContent);
  }, [initialContent]);

  // File watcher hook - reloads content when file changes externally
  const handleContentReload = useCallback((newContent: string) => {
    setContent(newContent);
    onContentChange?.(newContent);
  }, [onContentChange]);

  // Only enable file watcher if explicitly requested
  // Editor mode: auto-reload without confirmation
  useFileWatcher({
    filePath: enableFileWatcher ? filePath : "",
    onContentReload: handleContentReload,
    autoReload: true, // Always auto-reload in editor mode
  });

  const handleChange = (value: string | undefined) => {
    if (value === undefined) return;

    setContent(value);
    if (onContentChange) {
      onContentChange(value); // Notify parent (handles save in pane context)
    } else {
      handleContentChange(value, { filePath, tabId, isDeleted });
    }
  };

  const handleBeforeMount: BeforeMount = (monaco) => {
    monacoRef.current = monaco;

    // Configure language settings (TypeScript, JavaScript, CSS)
    configureMonacoLanguages(monaco);

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

    // Listen for AI content insertion
    unlisteners.push(listen<{ text: string }>('editor:insert-ai', (event) => {
      const text = event.payload.text;
      if (!text) return;

      const position = editor.getPosition() || editor.getModel()?.getFullModelRange().getEndPosition();
      const range = position ? new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column) : null;

      if (range) {
        editor.executeEdits("ai-source", [{
          range: range,
          text: text,
          forceMoveMarkers: true
        }]);
      }
    }));

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

    // Register cursor position change listener for status bar updates.
    // Only dispatch events when this tab is active to avoid clobbering
    // the status bar from a background (hidden) tab.
    editor.onDidChangeCursorPosition((e: any) => {
      if (!isTabActive) return;
      window.dispatchEvent(new CustomEvent('editor-cursor', {
        detail: {
          lineNumber: e.position.lineNumber,
          column: e.position.column
        }
      }));
    });

    // Dispatch initial cursor position
    const initPos = editor.getPosition();
    if (initPos && isTabActive) {
      window.dispatchEvent(new CustomEvent('editor-cursor', {
        detail: {
          lineNumber: initPos.lineNumber,
          column: initPos.column
        }
      }));
    }

    // Store cleanup function
    menuListenersCleanupRef.current = () => {
      unlisteners.forEach(p => p.then(u => u()));
      // Reset status bar cursor on unmount
      window.dispatchEvent(new CustomEvent('editor-cursor', {
        detail: null
      }));
    };
  };

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      menuListenersCleanupRef.current?.();

    };
  }, []);

  // Relay layout when tab becomes visible after display:none → display:block.
  // Monaco's ResizeObserver may not fire reliably on visibility toggles.
  useEffect(() => {
    if (isTabActive && editorRef.current) {
      requestAnimationFrame(() => {
        editorRef.current?.layout();
      });
    }
  }, [isTabActive]);

  // Handle line jumping
  useLineJump({ editorRef, lineNumber });

  // Handle PlantUML click-to-jump
  useEffect(() => {
    if (!plantUMLJump || !editorRef.current) return;
    const { lineNumber: targetLine } = plantUMLJump;
    editorRef.current.revealLineInCenter(targetLine);
    editorRef.current.setPosition({ lineNumber: targetLine, column: 1 });
    editorRef.current.focus();
    setPlantUMLJump(null);
  }, [plantUMLJump, setPlantUMLJump]);

  console.log("MonacoEditorReact language", language)

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
            padding: { top: 16, bottom: 40 },
          }}
        />
      </MonacoThemeLoader>
    </div>
  );
}
