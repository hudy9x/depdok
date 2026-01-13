import { useEffect, useRef } from "react";
import MonacoEditorReact, { OnMount } from "@monaco-editor/react";
import { useDebouncedCallback } from "use-debounce";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useAtomValue, useSetAtom } from "jotai";
import { toast } from "sonner";

import { editorStateAtom, markAsSavedAtom } from "@/stores/EditorStore";

interface MonacoEditorProps {
  value: string;
  language: string;
  onChange: (value: string | undefined) => void;
}

export function MonacoEditor({ value, language, onChange }: MonacoEditorProps) {
  const editorState = useAtomValue(editorStateAtom);
  const markAsSaved = useSetAtom(markAsSavedAtom);
  const editorRef = useRef<any>(null);

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  // Auto-save with debounce
  const debouncedSave = useDebouncedCallback(async (content: string) => {
    if (!editorState.filePath) return;

    try {
      await writeTextFile(editorState.filePath, content);
      markAsSaved();
    } catch (error) {
      console.error("Error saving file:", error);
      toast.error("Failed to save file");
    }
  }, 1000);

  useEffect(() => {
    if (editorState.isDirty && editorState.fileContent) {
      debouncedSave(editorState.fileContent);
    }
  }, [editorState.isDirty, editorState.fileContent, debouncedSave]);

  return (
    <div className="w-full h-full">
      <MonacoEditorReact
        value={value}
        language={language}
        theme="vs-dark"
        onChange={onChange}
        onMount={handleEditorDidMount}
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
