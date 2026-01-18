import { useSearchParams } from "react-router-dom";
import { useSetAtom, useAtomValue } from "jotai";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import { Titlebar } from "@/features/Titlebar";
import { MonacoEditor } from "@/features/Editor/MonacoEditor";
import { PreviewPanel } from "@/features/Preview/PreviewPanel";
import { EditorLeftActions } from "@/features/Editor/EditorLeftActions";
import { EditorRightActions } from "@/features/Editor/EditorRightActions";
import { LoadFileContent } from "@/features/Editor/LoadFileContent";
import { EditorSave } from "@/features/Editor/EditorSaveHandler";
import {
  editorStateAtom,
  loadFileMetadataAtom,
  viewModeAtom,
} from "@/stores/EditorStore";

export default function Editor() {
  const [searchParams] = useSearchParams();
  const editorState = useAtomValue(editorStateAtom);
  const viewMode = useAtomValue(viewModeAtom);
  const loadFileMetadata = useSetAtom(loadFileMetadataAtom);

  const filePath = searchParams.get("path") || "";

  return (
    <>
      <Titlebar
        left={<EditorLeftActions />}
        center={null}
        right={<EditorRightActions />}
      />
      <EditorSave />

      <LoadFileContent filePath={filePath} onMetadataLoad={loadFileMetadata}>
        {(initialContent) => (
          <div className="fixed top-[35px] h-[calc(100vh-35px)] left-0 w-full flex flex-col bg-background">
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
