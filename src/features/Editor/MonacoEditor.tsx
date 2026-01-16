import { useState, useRef, useEffect } from "react";
import MonacoEditorReact from "@monaco-editor/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useDebouncedCallback } from "use-debounce";
import { writeTextFile } from "@tauri-apps/plugin-fs";

import { editorStateAtom, markAsDirtyAtom, markAsSavedAtom } from "@/stores/EditorStore";
import { autoSaveEnabledAtom, autoSaveDelayAtom } from "@/stores/SettingsStore";
import { draftService } from "@/lib/indexeddb";

interface MonacoEditorProps {
  initialContent: string;
  language: string;
}

export function MonacoEditor({ initialContent, language }: MonacoEditorProps) {
  const [content, setContent] = useState(initialContent);
  const editorState = useAtomValue(editorStateAtom);
  const autoSaveEnabled = useAtomValue(autoSaveEnabledAtom);
  const autoSaveDelay = useAtomValue(autoSaveDelayAtom);
  const markAsDirty = useSetAtom(markAsDirtyAtom);
  const markAsSaved = useSetAtom(markAsSavedAtom);
  const editorRef = useRef<any>(null);

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
    debouncedSaveDraft(value); // Always save draft
    debouncedAutoSave(value);  // Auto-save if enabled
  };

  return (
    <div className="w-full h-full">
      <MonacoEditorReact
        value={content}
        language={language}
        theme="vs-dark"
        onChange={handleChange}
        onMount={(editor) => { editorRef.current = editor; }}
        options={{
          fontSize: 14,
          fontFamily: "Monaco, Menlo, 'Courier New', monospace",
          lineNumbers: "on",
          minimap: { enabled: true },
          wordWrap: "on",
          automaticLayout: true,
          scrollBeyondLastLine: false,
          padding: { top: 16, bottom: 16 },
        }}
      />
    </div>
  );
}
