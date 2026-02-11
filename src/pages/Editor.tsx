import { useSearchParams, useNavigate } from "react-router-dom";
import { useSetAtom, useAtomValue, useAtom } from "jotai";
import { useEffect, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle, ImperativePanelHandle } from "react-resizable-panels";

import { Titlebar } from "@/features/Titlebar";
import { MonacoEditor } from "@/features/Editor/MonacoEditor";
import { PreviewPanel } from "@/features/Preview/PreviewPanel";
import { PreviewFileWatcher } from "@/features/Preview/PreviewFileWatcher";
import { SideBySide } from "@/features/SidebySide";
import { EditorRightActions } from "@/features/Editor/EditorRightActions";
import { EditorTabs } from "@/features/EditorTabs";
import { LoadFileContent } from "@/features/Editor/LoadFileContent";
import { EditorSave } from "@/features/Editor/EditorSaveHandler";
import { FileExplorer } from "@/features/FileExplorer";
import { isFileExplorerVisibleAtom, isFileExplorerAutoHoverAtom } from "@/features/FileExplorer/store";
import { useAutoHideSidebar } from "@/features/FileExplorer/hooks/useAutoHideSidebar";
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
  markTabAsSavedAtom,
} from "@/stores/TabStore";
import { getMonacoLanguage } from "@/lib/utils/getMonacoLanguage";

import { useAutoSave } from "@/features/Editor/useAutoSave";
import { FileSearchDialog } from "@/features/FileSearchDialog";
import { ContentSearchDialog } from "@/features/ContentSearchDialog";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";

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
  const isFileExplorerVisible = useAtomValue(isFileExplorerVisibleAtom);
  const isAutoHover = useAtomValue(isFileExplorerAutoHoverAtom);
  const fileExplorerPanelRef = useRef<ImperativePanelHandle>(null);

  // Auto-hide sidebar hook
  const { sidebarRef } = useAutoHideSidebar();

  // Initialize global shortcuts (e.g. Cmd+B to toggle explorer)
  useGlobalShortcuts();

  const { handleContentChange: handleSaveContent } = useAutoSave();
  const markTabAsSaved = useSetAtom(markTabAsSavedAtom);

  // Handle external file changes (from file watcher)
  // Just mark the tab as saved, DO NOT save back to disk (prevents loop)
  // The content update is handled by the component's internal state
  const handleExternalReload = (_newContent: string) => {
    if (activeTab) {
      markTabAsSaved(activeTab.id);
    }
  };

  const filePath = searchParams.get("path") || "";

  // Track if this is the initial mount to avoid redirecting during hydration
  const isInitialMount = useRef(true);

  // Control panel collapse/expand
  useEffect(() => {
    if (fileExplorerPanelRef.current) {
      if (isFileExplorerVisible) {
        fileExplorerPanelRef.current.expand();
      } else {
        fileExplorerPanelRef.current.collapse();
      }
    }
  }, [isFileExplorerVisible]);


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
      <ContentSearchDialog />
      <Titlebar
        left={null}
        center={<EditorTabs />}
        right={<EditorRightActions />}
      />
      <EditorSave />

      <div className="fixed top-[35px] h-[calc(100vh-35px)] left-0 w-full flex flex-col px-1.5 pb-1.5 bg-background">
        <div className="h-full w-full bg-background border border-border rounded-lg overflow-hidden shadow-lg">
          <PanelGroup direction="horizontal" id="editor-layout" autoSaveId="depdok-editor-layout">
            {/* File Explorer Panel - always rendered, controlled by collapse state */}
            <Panel
              ref={fileExplorerPanelRef}
              defaultSize={20}
              minSize={15}
              maxSize={40}
              id="file-explorer"
              collapsible={true}
              collapsedSize={0}
            >
              {isFileExplorerVisible && (
                <div className="h-full border-r border-border">
                  <FileExplorer />
                </div>
              )}
            </Panel>

            {isFileExplorerVisible && (
              <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />
            )}

            {/* Editor Panel */}
            <Panel defaultSize={80} id="editor-content">
              <LoadFileContent filePath={currentFilePath} onMetadataLoad={loadFileMetadata}>
                {(initialContent) => (
                  <>
                    {viewMode === 'side-by-side' && (
                      <SideBySide
                        initialContent={initialContent}
                        enableFileWatcher={true}
                        lineNumber={activeTab?.lineNumber}
                      />
                    )}

                    {viewMode === 'editor-only' && (
                      <MonacoEditor
                        initialContent={initialContent}
                        language={getMonacoLanguage(editorState.fileExtension)}
                        enableFileWatcher={true}
                        lineNumber={activeTab?.lineNumber}
                      />
                    )}

                    {viewMode === 'preview-only' && (
                      <PreviewFileWatcher
                        content={initialContent}
                        enableFileWatcher={true}
                        onContentReload={handleExternalReload}
                      >
                        {(content) => (
                          <PreviewPanel
                            content={content}
                            fileExtension={editorState.fileExtension}
                            editable={true}
                            onContentChange={handleSaveContent}
                          />
                        )}
                      </PreviewFileWatcher>
                    )}
                  </>
                )}
              </LoadFileContent>
            </Panel>
          </PanelGroup>

          {/* Auto-hide overlay FileExplorer - only when hidden */}
          {!isFileExplorerVisible && (
            <div
              ref={sidebarRef}
              className={`
                fixed top-10 left-3 h-[calc(100vh-50px)] w-[300px] bg-background rounded-md border border-border
                transition-transform duration-300 ease-in-out z-50
                ${isAutoHover ? 'translate-x-0' : '-translate-x-[350px]'}
              `}
              style={{ boxShadow: isAutoHover ? '4px 0 12px rgba(0, 0, 0, 0.1)' : 'none' }}
            >
              <FileExplorer />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

