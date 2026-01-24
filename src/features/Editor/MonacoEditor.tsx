import { useState, useRef, useEffect } from "react";
import MonacoEditorReact, { BeforeMount, OnMount } from "@monaco-editor/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useDebouncedCallback } from "use-debounce";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { MonacoThemeLoader } from "./MonacoThemeLoader";

import { editorStateAtom, markAsDirtyAtom, markAsSavedAtom } from "@/stores/EditorStore";
import { autoSaveEnabledAtom, autoSaveDelayAtom } from "@/stores/SettingsStore";
import { draftService } from "@/lib/indexeddb";
import { setupMermaidTheme } from '@/lib/monaco-theme';
import { registerFormatAction } from '@/lib/monaco-actions';


interface MonacoEditorProps {
  initialContent: string;
  language: string;
  onContentChange?: (content: string) => void;
}

export function MonacoEditor({ initialContent, language, onContentChange }: MonacoEditorProps) {
  const [content, setContent] = useState(initialContent);
  const editorState = useAtomValue(editorStateAtom);
  const autoSaveEnabled = useAtomValue(autoSaveEnabledAtom);
  const autoSaveDelay = useAtomValue(autoSaveDelayAtom);
  const markAsDirty = useSetAtom(markAsDirtyAtom);
  const markAsSaved = useSetAtom(markAsSavedAtom);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  // Sync content when initialContent changes
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  // Debounced IndexedDB draft save (always happens)
  const debouncedSaveDraft = useDebouncedCallback(async (newContent: string) => {
    if (!editorState.filePath) return;
    await draftService.saveDraft(editorState.filePath, newContent);
    markAsDirty();
  }, 500);

  // Debounced auto-save to file (only if enabled)
  const debouncedAutoSave = useDebouncedCallback(async (newContent: string) => {
    if (!editorState.filePath || !autoSaveEnabled) return;

    try {
      await writeTextFile(editorState.filePath, newContent);
      await draftService.removeDraft(editorState.filePath);
      markAsSaved();
    } catch (error) {
      console.error("Auto-save failed:", error);
    }
  }, autoSaveDelay);

  const handleChange = (value: string | undefined) => {
    if (value === undefined) return;

    setContent(value);
    onContentChange?.(value); // Notify parent
    debouncedSaveDraft(value); // Always save draft
    debouncedAutoSave(value);  // Auto-save if enabled
  };

  const handleBeforeMount: BeforeMount = (monaco) => {
    monacoRef.current = monaco;
    setupMermaidTheme(monaco);

  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    // Register format action with Shift+Alt+F
    const handleFormat = (formattedCode: string) => {
      setContent(formattedCode);
    };

    registerFormatAction(editor, monaco, handleFormat);

  };

  // Determine Monaco theme based on system theme and language

  return (
    <div className="w-full h-full">
      <MonacoThemeLoader>
        <MonacoEditorReact
          value={content}
          language={language}
          // Theme is handled by MonacoThemeLoader
          // theme={getMonacoTheme()} 
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
