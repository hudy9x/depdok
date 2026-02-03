import { useSearchParams, useNavigate } from "react-router-dom";
import { useSetAtom, useAtomValue, useAtom } from "jotai";
import { useEffect, useRef } from "react";

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
import { FileSearchDialog } from "@/features/FileSearchDialog";

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

  // Track if this is the initial mount to avoid redirecting during hydration
  const isInitialMount = useRef(true);



  // 1. Sync Active Tab -> URL
  // When active tab changes (e.g. user clicks tab, or closes active tab), update URL
  useEffect(() => {
    // Skip redirect on initial mount to allow hydration
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (activeTab && activeTab.filePath !== filePath) {
      navigate(`/editor?path=${encodeURIComponent(activeTab.filePath)}`, { replace: true });
    } else if (!activeTab && tabs.length === 0) {
      // If no tabs left, go home (only after initial mount)
      navigate('/home', { replace: true });
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

      const fileName = filePath.split(/[/\\]/).pop() || "Untitled";
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

  // Use active tab's file path, only if we have an active tab
  const currentFilePath = activeTab?.filePath;

  // If no file path, return null (we'll redirect to home via useEffect)
  if (!currentFilePath) {
    return null;
  }

  return (
    <>
      <FileSearchDialog />
      <Titlebar
        left={null}
        center={<EditorTabs />}
        right={<EditorRightActions />}
      />
      <EditorSave />

      <LoadFileContent filePath={currentFilePath} onMetadataLoad={loadFileMetadata}>
        {(initialContent) => (
          <div className="fixed top-[35px] h-[calc(100vh-35px)] left-0 w-full flex flex-col px-1.5 pb-1.5 bg-background">
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
