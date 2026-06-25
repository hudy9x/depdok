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

import { writeFileContent } from "@/lib/fileOperations";
import { draftService } from "@/lib/indexeddb";

import { editorStateAtom, activeFileContentAtom } from "@/stores/EditorStore";
import { isSavingAtom, lastSavedContentMap } from "@/stores/FileWatchStore";
import { autoSaveDelayAtom, autoSaveEnabledAtom } from "@/stores/SettingsStore";
import { activeTabAtom, isDummyPath, markTabAsDirtyAtom, markTabAsSavedAtom } from "@/stores/TabStore";

export function useAutoSave() {
  const editorState = useAtomValue(editorStateAtom);
  const activeTab = useAtomValue(activeTabAtom);
  const autoSaveEnabled = useAtomValue(autoSaveEnabledAtom);
  const autoSaveDelay = useAtomValue(autoSaveDelayAtom);

  const markTabAsDirty = useSetAtom(markTabAsDirtyAtom);
  const markTabAsSaved = useSetAtom(markTabAsSavedAtom);
  const setIsSaving = useSetAtom(isSavingAtom);
  const setActiveFileContent = useSetAtom(activeFileContentAtom);

  // Debounced IndexedDB draft save (always happens)
  const debouncedSaveDraft = useDebouncedCallback(
    async (payload: { content: string; filePath: string; tabId: string; paneId?: string }) => {
      const { content, filePath, tabId, paneId } = payload;
      if (!filePath) return;
      await draftService.saveDraft(filePath, content);

      // Mark active tab as dirty
      markTabAsDirty(paneId ? { tabId, paneId } : tabId);
    },
    500
  );

  // Debounced auto-save to file (only if enabled)
  const debouncedAutoSave = useDebouncedCallback(
    async (payload: { content: string; filePath: string; tabId: string; isDeleted?: boolean; paneId?: string }) => {
      const { content: newContent, filePath, tabId, isDeleted, paneId } = payload;
      if (!filePath || !autoSaveEnabled || isDummyPath(filePath)) return;

      // If the backing file was deleted externally, skip the disk write but keep
      // the draft in IndexedDB so the content stays recoverable.
      if (isDeleted) {
        console.log('[useAutoSave] Skipping disk write — tab is deleted (ghost):', filePath);
        return;
      }

      try {
        // Set flag (with file path) to prevent file watcher from reacting to our own save
        console.log("[useAutoSave] 💾 Auto-saving:", filePath, "| setting isSaving =", filePath);
        setIsSaving(filePath);

        await writeFileContent(filePath, newContent);
        // Record exactly what we wrote so useFileWatcher can skip false-positive toasts
        lastSavedContentMap.set(filePath, newContent);
        await draftService.removeDraft(filePath);

        // Mark active tab as saved
        markTabAsSaved(paneId ? { tabId, paneId } : tabId);

        // Clear flag after a short delay to ensure file system events have settled
        setTimeout(() => {
          console.log("[useAutoSave] 🔓 Clearing isSaving for:", filePath);
          setIsSaving(null);
        }, 1000);
      } catch (error) {
        console.error("Auto-save failed:", error);
        setIsSaving(null);
      }
    },
    autoSaveDelay
  );

  const handleContentChange = (
    value: string,
    options?: { filePath: string; tabId: string; isDeleted?: boolean; paneId?: string }
  ) => {
    const filePath = options?.filePath || editorState.filePath;
    const tabId = options?.tabId || activeTab?.id;
    const isDeleted = options?.isDeleted || activeTab?.isDeleted;
    const paneId = options?.paneId;

    setActiveFileContent(value);

    if (filePath && tabId) {
      debouncedSaveDraft({ content: value, filePath, tabId, paneId }); // Always save draft
      debouncedAutoSave({ content: value, filePath, tabId, isDeleted, paneId });  // Auto-save if enabled
    }
  };

  return {
    handleContentChange,
    saveDraft: debouncedSaveDraft,
    autoSave: debouncedAutoSave
  };
}
