import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAtom, useSetAtom } from "jotai";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";

import { Titlebar } from "@/features/Titlebar";
import { MonacoEditor } from "@/features/Editor/MonacoEditor";
import { PreviewPanel } from "@/features/Preview/PreviewPanel";
import {
  editorStateAtom,
  loadFileAtom,
  fileContentAtom,
} from "@/stores/EditorStore";

export default function Editor() {
  const [searchParams] = useSearchParams();
  const [editorState] = useAtom(editorStateAtom);
  const loadFile = useSetAtom(loadFileAtom);
  const setContent = useSetAtom(fileContentAtom);

  useEffect(() => {
    const filePath = searchParams.get("path");
    if (!filePath) {
      toast.error("No file path provided");
      return;
    }

    // Load file content
    const loadFileContent = async () => {
      try {
        const content = await readTextFile(filePath);
        const extension = filePath.split(".").pop()?.toLowerCase() || "";

        loadFile({
          path: filePath,
          content,
          extension,
        });
      } catch (error) {
        console.error("Error loading file:", error);
        toast.error("Failed to load file");
      }
    };

    loadFileContent();
  }, [searchParams, loadFile]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setContent(value);
    }
  };

  return (
    <>
      <Titlebar />

      <div className="fixed top-[35px] h-[calc(100vh-35px)] left-0 w-full h-full flex flex-col bg-background">

        <PanelGroup direction="horizontal" className="flex-1">
          <Panel defaultSize={50} minSize={30}>
            <MonacoEditor
              value={editorState.fileContent}
              language={editorState.fileExtension === "md" ? "markdown" : "plaintext"}
              onChange={handleEditorChange}
            />
          </Panel>

          <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />

          <Panel defaultSize={50} minSize={30}>
            <PreviewPanel
              content={editorState.fileContent}
              fileExtension={editorState.fileExtension}
            />
          </Panel>
        </PanelGroup>
      </div>
    </>
  );
}
