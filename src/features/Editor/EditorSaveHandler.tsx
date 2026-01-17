import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";

import { editorStateAtom, markAsSavedAtom } from "@/stores/EditorStore";
import { draftService } from "@/lib/indexeddb";

export function EditorSave() {
  const editorState = useAtomValue(editorStateAtom);
  const markAsSaved = useSetAtom(markAsSavedAtom);

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

      console.log(
        "[Editor] handleSave - saving from draft:",
        contentToSave?.substring(0, 100)
      );

      await writeTextFile(editorState.filePath, contentToSave);
      await draftService.removeDraft(editorState.filePath);
      markAsSaved();
      toast.success("File saved");
    } catch (error) {
      console.error("Error saving file:", error);
      toast.error("Failed to save file");
    }
  };

  // Keyboard shortcut for save (Ctrl+S or Cmd+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editorState.filePath]);

  return null;
}
