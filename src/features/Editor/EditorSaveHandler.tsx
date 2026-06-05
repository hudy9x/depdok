import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { save } from "@tauri-apps/plugin-dialog";
import { platform } from "@tauri-apps/plugin-os";
import { toast } from "sonner";

import { editorStateAtom, markAsSavedAtom } from "@/stores/EditorStore";
import { isSavingAtom, lastSavedContentMap } from "@/stores/FileWatchStore";
import { draftService } from "@/lib/indexeddb";
import {
  activeTabAtom,
  updateTabPathAtom,
  markTabAsSavedAtom,
  isDummyPath,
  extractFilenameFromDummyPath,
} from "@/stores/TabStore";
import { refreshDirectoryAtom, workspaceRootAtom } from "@/features/FileExplorer/store";
import { autoSaveEnabledAtom } from "@/stores/SettingsStore";
import { writeFileContent } from "@/lib/fileOperations";

const supportedFileTypes = ["md", "mmd", "txt", "pu", "format", "puml", "plantuml", "todo", "excalidraw", "logger"];


export function EditorSave() {
  const editorState = useAtomValue(editorStateAtom);
  const activeTab = useAtomValue(activeTabAtom);
  const autoSaveEnabled = useAtomValue(autoSaveEnabledAtom);
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const markAsSaved = useSetAtom(markAsSavedAtom);
  const updateTabPath = useSetAtom(updateTabPathAtom);
  const markTabAsSaved = useSetAtom(markTabAsSavedAtom);
  const setIsSaving = useSetAtom(isSavingAtom);
  const refreshDirectory = useSetAtom(refreshDirectoryAtom);

  const normalizeWindowsSavePath = (path: string): string => {
    let normalized = path.replace(/\//g, "\\");

    if (!workspaceRoot) return normalized;

    const workspace = workspaceRoot.replace(/\//g, "\\").replace(/\\+$/, "");
    const workspaceName = workspace.split(/[/\\]/).pop() || "";
    const lastSlash = workspace.lastIndexOf("\\");
    const parentDir = lastSlash >= 0 ? workspace.slice(0, lastSlash + 1) : "";

    // Repair malformed path pattern seen on Windows: "<workspace>-<subpath>"
    if (normalized.startsWith(`${workspace}-`)) {
      const suffix = normalized.slice(workspace.length + 1).replace(/^[\\/]+/, "");
      return `${workspace}\\${suffix}`;
    }

    // Repair variant: "<parent><workspaceName>-<subpath>"
    if (workspaceName && parentDir && normalized.startsWith(`${parentDir}${workspaceName}-`)) {
      const suffix = normalized.slice((`${parentDir}${workspaceName}-`).length).replace(/^[\\/]+/, "");
      return `${workspace}\\${suffix}`;
    }

    return normalized;
  };

  const handleSaveAs = async (currentPath: string) => {
    try {
      // Extract filename from UNTITLED://filename.ext
      const rawFilename = extractFilenameFromDummyPath(currentPath);
      const filename = rawFilename.split(/[/\\]/).pop() || rawFilename;
      const extMatch = filename.match(/\.([^.]+)$/);
      const ext = extMatch ? extMatch[1].toLowerCase() : "";

      const filters = [];
      if (ext && supportedFileTypes.includes(ext)) {
        filters.push({
          name: `${ext.toUpperCase()} File`,
          extensions: [ext],
        });
      }
      filters.push({
        name: "Documentation Files",
        extensions: supportedFileTypes,
      });

      // Open save dialog
      const isWindows = platform() === "windows";
      const defaultPath = isWindows && workspaceRoot
        ? `${workspaceRoot}\\${filename}`
        : filename;

      const selected = await save({
        defaultPath,
        filters,
      });

      if (!selected) {
        return; // User cancelled
      }

      const selectedPath = isWindows
        ? normalizeWindowsSavePath(selected)
        : selected;

      // Get draft content
      let draft = await draftService.getDraft(currentPath);

      if (!draft && currentPath.endsWith(".logger")) {
        draft = { 
          filePath: currentPath,
          timestamp: Date.now(),
          content: JSON.stringify({
            filterLevel: "all",
            showMessageOnly: false,
            filterText: "",
            driver: "nodejs"
          }, null, 2)
        };
      }

      if (!draft) {
        toast.error("No content to save");
        return;
      }

      // Set flag (with file path) to prevent file watcher from reacting
      setIsSaving(selectedPath);

      // Write to new location
      await writeFileContent(selectedPath, draft.content);
      lastSavedContentMap.set(selectedPath, draft.content);

      // Refresh file explorer for the parent folder
      const parentDir = selectedPath.substring(0, Math.max(selectedPath.lastIndexOf('/'), selectedPath.lastIndexOf('\\')));
      if (parentDir) {
        refreshDirectory(parentDir).catch(console.error);
      }

      // Update tab with real path
      if (activeTab) {
        updateTabPath({ tabId: activeTab.id, newPath: selectedPath });
        markTabAsSaved(activeTab.id);
      }

      // Clean up old draft
      await draftService.removeDraft(currentPath);

      // Mark as saved in editor store
      markAsSaved();

      toast.success("File saved successfully");

      // Clear flag after delay
      setTimeout(() => setIsSaving(null), 1000);
    } catch (error) {
      console.error("Error in save-as:", error);
      toast.error("Failed to save file");
      setIsSaving(null);
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
      let draft = await draftService.getDraft(editorState.filePath);

      if (!draft && editorState.filePath.endsWith(".logger")) {
        draft = { 
          filePath: editorState.filePath,
          timestamp: Date.now(),
          content: JSON.stringify({
            filterLevel: "all",
            showMessageOnly: false,
            filterText: "",
            driver: "nodejs"
          }, null, 2)
        };
      }

      if (!draft) {
        toast.error("No content to save");
        return;
      }

      const contentToSave = draft.content;

      console.log(
        "[Editor] handleSave - saving from draft:",
        contentToSave?.substring(0, 100)
      );

      // Set flag (with file path) to prevent file watcher from reacting
      setIsSaving(editorState.filePath);

      await writeFileContent(editorState.filePath, contentToSave);
      lastSavedContentMap.set(editorState.filePath, contentToSave);
      await draftService.removeDraft(editorState.filePath);

      // Mark both editor and tab as saved
      markAsSaved();
      if (activeTab) {
        markTabAsSaved(activeTab.id);
      }

      // Clear flag after delay
      setTimeout(() => setIsSaving(null), 1000);
    } catch (error) {
      console.error("Error saving file:", error);
      toast.error("Failed to save file");
      setIsSaving(null);
    }
  };

  // Keyboard shortcut for save (Ctrl+S or Cmd+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        
        if (autoSaveEnabled) {
          console.log("[EditorSaveHandler] ⌨️ window Cmd+S caught but ignored because AutoSave is ON");
          return;
        }

        console.log("[EditorSaveHandler] ⌨️ window Cmd+S caught — filePath:", editorState.filePath);
        handleSave();
      }
    };

    // Use capture phase so this fires BEFORE ExcalidrawPreview's capture-phase
    // stopImmediatePropagation() on its wrapper div. Capture goes top-down:
    // window(capture) → div(capture) → ... → bubble, so window capture fires first.
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [editorState.filePath, activeTab, autoSaveEnabled]);

  return null;
}
