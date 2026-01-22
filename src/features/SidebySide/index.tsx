
import { useState, useCallback } from "react";
import { useAtomValue } from "jotai";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import { MonacoEditor } from "@/features/Editor/MonacoEditor";
import { PreviewPanel } from "@/features/Preview/PreviewPanel";
import { editorStateAtom } from "@/stores/EditorStore";
import { getMonacoLanguage } from "@/lib/utils/getMonacoLanguage";

interface SideBySideProps {
  initialContent: string;
}

export function SideBySide({ initialContent }: SideBySideProps) {
  const [content, setContent] = useState(initialContent);
  const editorState = useAtomValue(editorStateAtom);

  const handleEditorChange = useCallback((newContent: string) => {
    setContent(newContent);
  }, []);

  const language = getMonacoLanguage(editorState.fileExtension);

  return (
    <PanelGroup direction="horizontal" className="flex-1">
      <Panel defaultSize={50} minSize={30}>
        <MonacoEditor
          initialContent={initialContent}
          language={language}
          onContentChange={handleEditorChange}
        />
      </Panel>

      <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />

      <Panel defaultSize={50} minSize={30}>
        <PreviewPanel
          content={content}
          fileExtension={editorState.fileExtension}
        />
      </Panel>
    </PanelGroup>
  );
}
