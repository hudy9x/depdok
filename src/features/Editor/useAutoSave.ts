import { useAtomValue, useSetAtom } from "jotai";
import { useDebouncedCallback } from "use-debounce";
import { writeTextFile } from "@tauri-apps/plugin-fs";

import { editorStateAtom, markAsDirtyAtom, markAsSavedAtom } from "@/stores/EditorStore";
import { activeTabAtom, markTabAsDirtyAtom, markTabAsSavedAtom } from "@/stores/TabStore";
import { autoSaveEnabledAtom, autoSaveDelayAtom } from "@/stores/SettingsStore";
import { draftService } from "@/lib/indexeddb";

export function useAutoSave() {
  const editorState = useAtomValue(editorStateAtom);
  const activeTab = useAtomValue(activeTabAtom);
  const autoSaveEnabled = useAtomValue(autoSaveEnabledAtom);
  const autoSaveDelay = useAtomValue(autoSaveDelayAtom);

  const markAsDirty = useSetAtom(markAsDirtyAtom);
  const markAsSaved = useSetAtom(markAsSavedAtom);
  const markTabAsDirty = useSetAtom(markTabAsDirtyAtom);
  const markTabAsSaved = useSetAtom(markTabAsSavedAtom);

  // Debounced IndexedDB draft save (always happens)
  const debouncedSaveDraft = useDebouncedCallback(async (newContent: string) => {
    if (!editorState.filePath) return;
    await draftService.saveDraft(editorState.filePath, newContent);
    markAsDirty();

    // Mark active tab as dirty
    if (activeTab) {
      markTabAsDirty(activeTab.id);
    }
  }, 500);

  // Debounced auto-save to file (only if enabled)
  const debouncedAutoSave = useDebouncedCallback(async (newContent: string) => {
    if (!editorState.filePath || !autoSaveEnabled) return;

    try {
      await writeTextFile(editorState.filePath, newContent);
      await draftService.removeDraft(editorState.filePath);
      markAsSaved();

      // Mark active tab as saved
      if (activeTab) {
        markTabAsSaved(activeTab.id);
      }
    } catch (error) {
      console.error("Auto-save failed:", error);
    }
  }, autoSaveDelay);

  const handleContentChange = (value: string) => {
    debouncedSaveDraft(value); // Always save draft
    debouncedAutoSave(value);  // Auto-save if enabled
  };

  return {
    handleContentChange,
    saveDraft: debouncedSaveDraft,
    autoSave: debouncedAutoSave
  };
}
