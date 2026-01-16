import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSetAtom, useAtomValue } from "jotai";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";

import { Titlebar } from "@/features/Titlebar";
import { MonacoEditor } from "@/features/Editor/MonacoEditor";
import { PreviewPanel } from "@/features/Preview/PreviewPanel";
import { EditorToolbar } from "@/features/Editor/EditorToolbar";
import { RecoveryDialog } from "@/components/RecoveryDialog";
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

  const [initialContent, setInitialContent] = useState("");
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [draftContent, setDraftContent] = useState("");

  // Load file on mount
  useEffect(() => {
    const filePath = searchParams.get("path");
    if (!filePath) {
      toast.error("No file path provided");
      return;
    }

    const loadFile = async () => {
      try {
        // 1. Load file from disk
        const fileContent = await readTextFile(filePath);
        const extension = filePath.split(".").pop()?.toLowerCase() || "";

        // 2. Check for draft in IndexedDB
        const draft = await draftService.getDraft(filePath);

        console.log('fileContent', fileContent, draft)

        if (draft && draft.content !== fileContent) {
          // Draft exists and differs from file
          setDraftContent(draft.content);
          setShowRecoveryDialog(true);
          setInitialContent(fileContent); // Keep file content as fallback
        } else {
          // No draft or draft matches file
          setInitialContent(fileContent);
        }

        // Update metadata
        loadFileMetadata({
          path: filePath,
          extension,
          isDirty: !!draft,
        });
      } catch (error) {
        console.error("Error loading file:", error);
        toast.error("Failed to load file");
      }
    };

    loadFile();
  }, [searchParams, loadFileMetadata]);

  const handleRecoveryChoice = (useDraft: boolean) => {
    const content = useDraft ? draftContent : initialContent;
    setInitialContent(content);
    setShowRecoveryDialog(false);
  };

  const handleSave = async () => {
    if (!editorState.filePath) return;

    try {
      // Get content from IndexedDB draft
      const draft = await draftService.getDraft(editorState.filePath);
      const contentToSave = draft?.content || initialContent;

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

      {showRecoveryDialog && (
        <RecoveryDialog
          onUseDraft={() => handleRecoveryChoice(true)}
          onUseFile={() => handleRecoveryChoice(false)}
        />
      )}

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
    </>
  );
}
