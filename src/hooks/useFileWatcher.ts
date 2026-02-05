import { useEffect, useCallback } from "react";
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
}

/**
 * Custom hook to watch a file for external changes
 * Automatically reloads content when file is not dirty, shows notification when dirty
 */
export function useFileWatcher({ filePath, onContentReload }: UseFileWatcherOptions) {
  const activeTab = useAtomValue(activeTabAtom);
  const isSaving = useAtomValue(isSavingAtom);

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
        // READ visual flow at useAutoSave.ts to understand how isSaving works
        // Ignore if we're currently saving from the app
        if (isSaving) {
          console.log("Ignoring file change event - app is saving");
          return;
        }

        // Verify this event is for the currently active file
        if (changedFilePath !== filePath) return;
        if (!activeTab) return;

        // Check if the current tab is dirty
        if (activeTab.isDirty) {
          // Show notification with action buttons
          toast.warning("File changed externally", {
            description: "The file has been modified outside the editor.",
            action: {
              label: "Reload",
              onClick: reloadFileContent,
            },
            cancel: {
              label: "Keep Current",
              onClick: () => {
                // Just dismiss the toast
              },
            },
            duration: Infinity, // Keep toast visible until user acts
          });
        } else {
          // Automatically reload the file
          reloadFileContent();
        }
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [filePath, activeTab, reloadFileContent, isSaving]);
}
