import { useSearchParams } from "react-router-dom";
import { useSetAtom, useAtomValue } from "jotai";


import { Titlebar } from "@/features/Titlebar";
import { MonacoEditor } from "@/features/Editor/MonacoEditor";
import { PreviewPanel } from "@/features/Preview/PreviewPanel";
import { SideBySide } from "@/features/SidebySide";
import { EditorLeftActions } from "@/features/Editor/EditorLeftActions";
import { EditorRightActions } from "@/features/Editor/EditorRightActions";
import { LoadFileContent } from "@/features/Editor/LoadFileContent";
import { EditorSave } from "@/features/Editor/EditorSaveHandler";
import {
  editorStateAtom,
  loadFileMetadataAtom,
  viewModeAtom,
} from "@/stores/EditorStore";
import { getMonacoLanguage } from "@/lib/utils/getMonacoLanguage";

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
          <div className="fixed top-[35px] h-[calc(100vh-35px)] left-0 w-full flex flex-col px-1.5 pb-1.5 bg-secondary">
            <div className="h-full w-full bg-background border border-border rounded-lg overflow-hidden shadow-lg">
              {viewMode === 'side-by-side' && (
                <SideBySide initialContent={initialContent} />
              )}

              {viewMode === 'editor-only' && (
                <MonacoEditor
                  initialContent={initialContent}
                  language={getMonacoLanguage(editorState.fileExtension)}
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

          </div>
        )}
      </LoadFileContent>
    </>
  );
}
