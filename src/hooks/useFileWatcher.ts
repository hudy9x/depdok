import { useEffect, useCallback, useRef } from "react";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";
import { startWatching, stopWatching, onFileChanged } from "@/lib/fileWatcher";
import { draftService } from "@/lib/indexeddb";
import { useAtomValue } from "jotai";
import { activeTabAtom } from "@/stores/TabStore";
import { isSavingAtom } from "@/stores/FileWatchStore";

interface UseFileWatcherOptions {
  filePath: string;
  onContentReload: (newContent: string) => void;
  /**
   * If true, tries to result in auto-reload (unless dirty).
   * If false, ALWAYS shows confirmation dialog (for preview mode).
   * Default: true
   */
  autoReload?: boolean;
}

/**
 * Custom hook to watch a file for external changes
 * - autoReload=true: Automatically reloads content if clean, warns if dirty.
 * - autoReload=false: Shows confirmation dialog always (debounced).
 */
export function useFileWatcher({
  filePath,
  onContentReload,
  autoReload = true
}: UseFileWatcherOptions) {
  const activeTab = useAtomValue(activeTabAtom);
  const isSaving = useAtomValue(isSavingAtom);

  // Track the last file path we showed a toast for, to prevent duplicates
  const pendingReloadRef = useRef<string | null>(null);

  // Reload file content from disk
  const reloadFileContent = useCallback(async () => {
    try {
      const isUntitled = filePath.startsWith("UNTITLED://");
      if (isUntitled) return; // Don't reload untitled files

      const loadedFileContent = await readTextFile(filePath);

      // Update content via callback
      onContentReload(loadedFileContent);

      // Clear the draft since we're loading fresh content
      await draftService.removeDraft(filePath);

      toast.success("File reloaded from disk");

      // Clear pending state
      pendingReloadRef.current = null;
    } catch (error) {
      console.error("Error reloading file:", error);
      toast.error("Failed to reload file");
    }
  }, [filePath, onContentReload]);

  // Start watching the file when component mounts or filePath changes
  useEffect(() => {
    const isUntitled = filePath.startsWith("UNTITLED://");

    if (!isUntitled && filePath) {
      startWatching(filePath).catch((error) => {
        console.error("Failed to start watching file:", error);
      });
    }

    return () => {
      // Stop watching when component unmounts or filePath changes
      stopWatching();
    };
  }, [filePath]);

  // Setup file change listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      unlisten = await onFileChanged((changedFilePath) => {
        console.log("[FileWatcher] Event received:", changedFilePath, "Current watched:", filePath);

        // READ visual flow at useAutoSave.ts to understand how isSaving works
        // Ignore if we're currently saving from the app
        if (isSaving) {
          console.log("[FileWatcher] Ignoring file change event - app is saving");
          return;
        }

        // Verify this event is for the currently active file
        if (changedFilePath !== filePath) {
          console.log("[FileWatcher] Path mismatch. Event:", changedFilePath, "Watched:", filePath);
          return;
        }
        if (!activeTab) {
          console.log("[FileWatcher] No active tab");
          return;
        }

        console.log("[FileWatcher] Processing change. AutoReload:", autoReload, "IsDirty:", activeTab.isDirty);

        const handleShowToast = () => {
          // Debounce: if we already have a pending reload notification for this file, don't show another
          if (pendingReloadRef.current === changedFilePath) {
            console.log("Ignoring duplicate file change event (dialog already open)");
            return;
          }

          pendingReloadRef.current = changedFilePath;

          toast.warning("File changed externally", {
            id: `file-change-${changedFilePath}`, // Ensure unique toast ID to avoid stacking if logic fails
            description: "The file has been modified outside the editor.",
            action: {
              label: "Reload",
              onClick: reloadFileContent,
            },
            cancel: {
              label: "Keep Current",
              onClick: () => {
                // User explicitly chose to keep current
                pendingReloadRef.current = null;
              },
            },
            duration: Infinity, // Keep toast visible until user acts
            onDismiss: () => {
              // Also clear on dismiss? Maybe safer not to, requiring explicit interaction,
              // but usually dismiss means "ignore".
              // Let's leave it null cleaning on explicit cancel or reload only logic above?
              // Actually if they dismiss, we should probably allow next notification.
              pendingReloadRef.current = null;
            }
          });
        };

        if (autoReload) {
          // Standard behavior (Editor / SideBySide)
          if (activeTab.isDirty) {
            // If dirty, we MUST warn to prevent data loss
            handleShowToast();
          } else {
            // If clean, we can auto-reload
            reloadFileContent();
          }
        } else {
          // Preview mode: user requested ALWAYS confirm
          handleShowToast();
        }
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [filePath, activeTab, reloadFileContent, isSaving, autoReload]);
}
