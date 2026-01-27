import { useSearchParams, useNavigate } from "react-router-dom";
import { useSetAtom, useAtomValue, useAtom } from "jotai";
import { useEffect } from "react";

import { Titlebar } from "@/features/Titlebar";
import { MonacoEditor } from "@/features/Editor/MonacoEditor";
import { PreviewPanel } from "@/features/Preview/PreviewPanel";
import { SideBySide } from "@/features/SidebySide";
import { EditorRightActions } from "@/features/Editor/EditorRightActions";
import { EditorTabs } from "@/features/EditorTabs";
import { LoadFileContent } from "@/features/Editor/LoadFileContent";
import { EditorSave } from "@/features/Editor/EditorSaveHandler";
import {
  editorStateAtom,
  loadFileMetadataAtom,
  viewModeAtom,
} from "@/stores/EditorStore";
import {
  activeTabAtom,
  createTabAtom,
  tabsAtom,
  switchTabAtom,
} from "@/stores/TabStore";
import { getMonacoLanguage } from "@/lib/utils/getMonacoLanguage";

import { useAutoSave } from "@/features/Editor/useAutoSave";

export default function Editor() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editorState = useAtomValue(editorStateAtom);
  const viewMode = useAtomValue(viewModeAtom);
  const loadFileMetadata = useSetAtom(loadFileMetadataAtom);
  const activeTab = useAtomValue(activeTabAtom);
  const createTab = useSetAtom(createTabAtom);
  const switchTab = useSetAtom(switchTabAtom);
  const [tabs] = useAtom(tabsAtom);

  const { handleContentChange: handleSaveContent } = useAutoSave();

  const filePath = searchParams.get("path") || "";



  // 1. Sync Active Tab -> URL
  // When active tab changes (e.g. user clicks tab, or closes active tab), update URL
  useEffect(() => {
    if (activeTab && activeTab.filePath !== filePath) {
      navigate(`/editor?path=${encodeURIComponent(activeTab.filePath)}`, { replace: true });
    } else if (!activeTab && tabs.length === 0 && filePath) {
      // If no tabs left but URL has path, clear it or go home?
      // navigate('/'); // Optional: Go home if all tabs closed
      // For now, let it be, but the "No file loaded" screen will show.
    }
  }, [activeTab, filePath, navigate, tabs.length]);

  // 2. Sync URL -> Tabs
  // When URL changes (e.g. back button, or external link), switch to or create tab
  useEffect(() => {
    if (!filePath) return;

    // Check if we already have this tab
    const existingTab = tabs.find(t => t.filePath === filePath);

    if (existingTab) {
      // If url matches a tab, switch to it if not active
      if (activeTab?.id !== existingTab.id) {
        switchTab(existingTab.id);
      }
    } else {
      // URL points to file not in tabs -> Create it
      // Intentionally ONLY checking filePath here. 
      // This prevents the effect from running when 'tabs' array changes (e.g. on close)
      // unless the URL ALSO changed.

      const fileName = filePath.split("/").pop() || "Untitled";
      createTab({ filePath, fileName, switchTo: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath]); // Only run when URL path changes!

  // Sync active tab with editor state
  useEffect(() => {
    if (activeTab) {
      loadFileMetadata({
        path: activeTab.filePath,
        extension: activeTab.fileExtension || "",
        isDirty: activeTab.isDirty,
      });
    }
  }, [activeTab, loadFileMetadata]);

  // Use active tab's file path, fallback to URL param
  const currentFilePath = activeTab?.filePath || filePath;

  if (!currentFilePath) {
    return (
      <>
        <Titlebar
          left={null}
          center={<EditorTabs />}
          right={<EditorRightActions />}
        />
        <div className="fixed top-[35px] h-[calc(100vh-35px)] left-0 w-full flex items-center justify-center bg-secondary">
          <p className="text-muted-foreground">No file loaded</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Titlebar
        left={null}
        center={<EditorTabs />}
        right={<EditorRightActions />}
      />
      <EditorSave />

      <LoadFileContent filePath={currentFilePath} onMetadataLoad={loadFileMetadata}>
        {(initialContent) => (
          <div className="fixed top-[35px] h-[calc(100vh-35px)] left-0 w-full flex flex-col px-1.5 pb-1.5 bg-secondary">
            <div className="h-full w-full bg-background border border-border rounded-lg overflow-hidden shadow-lg">
              {viewMode === 'side-by-side' && (
                <SideBySide initialContent={initialContent} />
              )}

              {viewMode === 'editor-only' && (
                <MonacoEditor
                  initialContent={initialContent}
                  language={getMonacoLanguage(editorState.fileExtension)}
                />
              )}

              {viewMode === 'preview-only' && (
                <PreviewPanel
                  content={initialContent}
                  fileExtension={editorState.fileExtension}
                  editable={true}
                  onContentChange={handleSaveContent}
                />
              )}
            </div>

          </div>
        )}
      </LoadFileContent>
    </>
  );
}
