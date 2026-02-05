/**
 * VISUAL FLOW: How isSaving flag prevents file watcher feedback loop
 * 
 * When app saves:
 * 1. isSaving = true          ← Set flag
 * 2. Write to disk            ← File changes
 * 3. File watcher fires       ← Detects change
 * 4. Check: isSaving? YES     ← See flag is true
 * 5. Return early             ← IGNORE the event
 * 6. (1 second later)
 * 7. isSaving = false         ← Clear flag
 * 
 * When external app saves:
 * 1. isSaving = false         ← Flag is false
 * 2. External write to disk   ← File changes
 * 3. File watcher fires       ← Detects change
 * 4. Check: isSaving? NO      ← Flag is false
 * 5. Proceed to reload        ← HANDLE the event
 */

import { useAtomValue, useSetAtom } from "jotai";
import { useDebouncedCallback } from "use-debounce";
import { writeTextFile } from "@tauri-apps/plugin-fs";

import { editorStateAtom, markAsDirtyAtom, markAsSavedAtom } from "@/stores/EditorStore";
import { activeTabAtom, markTabAsDirtyAtom, markTabAsSavedAtom } from "@/stores/TabStore";
import { autoSaveEnabledAtom, autoSaveDelayAtom } from "@/stores/SettingsStore";
import { isSavingAtom } from "@/stores/FileWatchStore";
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
  const setIsSaving = useSetAtom(isSavingAtom);

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
      // Set flag to prevent file watcher from reacting to our own save
      setIsSaving(true);

      await writeTextFile(editorState.filePath, newContent);
      await draftService.removeDraft(editorState.filePath);
      markAsSaved();

      // Mark active tab as saved
      if (activeTab) {
        markTabAsSaved(activeTab.id);
      }

      // Clear flag after a short delay to ensure file system events have settled
      setTimeout(() => {
        setIsSaving(false);
      }, 1000);
    } catch (error) {
      console.error("Auto-save failed:", error);
      setIsSaving(false);
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
