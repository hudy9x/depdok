import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";

import { editorStateAtom, markAsSavedAtom } from "@/stores/EditorStore";
import { isSavingAtom } from "@/stores/FileWatchStore";
import { draftService } from "@/lib/indexeddb";
import {
  activeTabAtom,
  updateTabPathAtom,
  markTabAsSavedAtom,
  isDummyPath,
  extractFilenameFromDummyPath,
} from "@/stores/TabStore";

const supportedFileTypes = ["md", "mmd", "txt", "pu", "puml", "plantuml", "todo"];

export function EditorSave() {
  const editorState = useAtomValue(editorStateAtom);
  const activeTab = useAtomValue(activeTabAtom);
  const markAsSaved = useSetAtom(markAsSavedAtom);
  const updateTabPath = useSetAtom(updateTabPathAtom);
  const markTabAsSaved = useSetAtom(markTabAsSavedAtom);
  const setIsSaving = useSetAtom(isSavingAtom);

  const handleSaveAs = async (currentPath: string) => {
    try {
      // Extract filename from UNTITLED://filename.ext
      const filename = extractFilenameFromDummyPath(currentPath);

      // Open save dialog
      const selected = await save({
        defaultPath: filename,
        filters: [
          {
            name: "Documentation Files",
            extensions: supportedFileTypes,
          },
        ],
      });

      if (!selected) {
        return; // User cancelled
      }

      // Get draft content
      const draft = await draftService.getDraft(currentPath);

      if (!draft) {
        toast.error("No content to save");
        return;
      }

      // Set flag to prevent file watcher from reacting
      setIsSaving(true);

      // Write to new location
      await writeTextFile(selected, draft.content);

      // Update tab with real path
      if (activeTab) {
        updateTabPath({ tabId: activeTab.id, newPath: selected });
        markTabAsSaved(activeTab.id);
      }

      // Clean up old draft
      await draftService.removeDraft(currentPath);

      // Mark as saved in editor store
      markAsSaved();

      toast.success("File saved successfully");

      // Clear flag after delay
      setTimeout(() => setIsSaving(false), 1000);
    } catch (error) {
      console.error("Error in save-as:", error);
      toast.error("Failed to save file");
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!editorState.filePath) return;

    // Check if this is a DUMMY_PATH file
    if (isDummyPath(editorState.filePath)) {
      await handleSaveAs(editorState.filePath);
      return;
    }

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

      // Set flag to prevent file watcher from reacting
      setIsSaving(true);

      await writeTextFile(editorState.filePath, contentToSave);
      await draftService.removeDraft(editorState.filePath);

      // Mark both editor and tab as saved
      markAsSaved();
      if (activeTab) {
        markTabAsSaved(activeTab.id);
      }

      // toast.success("File saved");

      // Clear flag after delay
      setTimeout(() => setIsSaving(false), 1000);
    } catch (error) {
      console.error("Error saving file:", error);
      toast.error("Failed to save file");
      setIsSaving(false);
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
  }, [editorState.filePath, activeTab]);

  return null;
}
