import { useEffect, useState, useCallback } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import { MonacoEditor } from "@/features/Editor/MonacoEditor";
import { PreviewPanel } from "@/features/Preview/PreviewPanel";
import { getMonacoLanguage } from "@/lib/utils/getMonacoLanguage";

interface SideBySideProps {
  initialContent: string;
  enableFileWatcher?: boolean; // Enable file watcher in the editor panel
  lineNumber?: number; // Line number to jump to in the editor
  filePath: string;
  tabId: string;
  isDeleted?: boolean;
  onContentChange?: (content: string) => void;
  /** Whether this tab is currently the active visible tab. */
  isTabActive?: boolean;
}

export function SideBySide({
  initialContent,
  enableFileWatcher = false,
  lineNumber,
  filePath,
  tabId,
  isDeleted,
  onContentChange,
  isTabActive = true,
}: SideBySideProps) {
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const handleEditorChange = useCallback((newContent: string) => {
    setContent(newContent);
    onContentChange?.(newContent);
  }, [onContentChange]);

  const fileExtension = filePath.split(".").pop()?.toLowerCase() || "";
  const language = getMonacoLanguage(fileExtension);

  return (
    <PanelGroup direction="horizontal" className="flex-1 w-full h-full">
      <Panel defaultSize={45} minSize={20} className="relative min-w-0 min-h-0 flex">
        <MonacoEditor
          initialContent={content}
          language={language}
          onContentChange={handleEditorChange}
          enableFileWatcher={enableFileWatcher}
          lineNumber={lineNumber}
          filePath={filePath}
          tabId={tabId}
          isDeleted={isDeleted}
          isTabActive={isTabActive}
        />
      </Panel>

      <PanelResizeHandle className="w-[4px] cursor-col-resize bg-border/40 hover:bg-primary/50 transition-colors h-full" />

      <Panel defaultSize={55} minSize={20} className="relative min-w-0 min-h-0 flex bg-layout-content overflow-y-auto">
        <PreviewPanel
          content={content}
          fileExtension={fileExtension}
          filePath={filePath}
          isTabActive={isTabActive}
        />
      </Panel>
    </PanelGroup>
  );
}
