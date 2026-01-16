import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useSetAtom, useAtomValue } from "jotai";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";

import { Titlebar } from "@/features/Titlebar";
import { MonacoEditor } from "@/features/Editor/MonacoEditor";
import { PreviewPanel } from "@/features/Preview/PreviewPanel";
import { EditorToolbar } from "@/features/Editor/EditorToolbar";
import { LoadFileContent } from "@/components/LoadFileContent";
import {
  editorStateAtom,
  loadFileMetadataAtom,
  markAsSavedAtom,
  viewModeAtom,
} from "@/stores/EditorStore";
import { draftService } from "@/lib/indexeddb";

export default function Editor() {
  const [searchParams] = useSearchParams();
  const editorState = useAtomValue(editorStateAtom);
  const viewMode = useAtomValue(viewModeAtom);
  const loadFileMetadata = useSetAtom(loadFileMetadataAtom);
  const markAsSaved = useSetAtom(markAsSavedAtom);

  const filePath = searchParams.get("path") || "";

  const handleSave = async () => {
    if (!editorState.filePath) return;

    try {
      // Get content from IndexedDB draft
      const draft = await draftService.getDraft(editorState.filePath);

      if (!draft) {
        toast.error("No content to save");
        return;
      }

      const contentToSave = draft.content;

      console.log('[Editor] handleSave - saving from draft:', contentToSave?.substring(0, 100));

      await writeTextFile(editorState.filePath, contentToSave);
      await draftService.removeDraft(editorState.filePath);
      markAsSaved();
      toast.success("File saved");
    } catch (error) {
      console.error("Error saving file:", error);
      toast.error("Failed to save file");
    }
  };

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editorState.filePath]);

  return (
    <>
      <Titlebar />
      <EditorToolbar onSave={handleSave} />

      <LoadFileContent filePath={filePath} onMetadataLoad={loadFileMetadata}>
        {(initialContent) => (
          <div className="fixed top-[45px] h-[calc(100vh-45px)] left-0 w-full flex flex-col bg-background">
            {viewMode === 'side-by-side' && (
              <PanelGroup direction="horizontal" className="flex-1">
                <Panel defaultSize={50} minSize={30}>
                  <MonacoEditor
                    initialContent={initialContent}
                    language={editorState.fileExtension === "md" ? "markdown" : "plaintext"}
                  />
                </Panel>

                <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />

                <Panel defaultSize={50} minSize={30}>
                  <PreviewPanel
                    content={initialContent}
                    fileExtension={editorState.fileExtension}
                  />
                </Panel>
              </PanelGroup>
            )}

            {viewMode === 'editor-only' && (
              <MonacoEditor
                initialContent={initialContent}
                language={editorState.fileExtension === "md" ? "markdown" : "plaintext"}
              />
            )}

            {viewMode === 'preview-only' && (
              <PreviewPanel
                content={initialContent}
                fileExtension={editorState.fileExtension}
                editable={true}
              />
            )}
          </div>
        )}
      </LoadFileContent>
    </>
  );
}
