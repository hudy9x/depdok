import { useSearchParams, useNavigate } from "react-router-dom";
import { useSetAtom, useAtomValue, useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle, ImperativePanelHandle } from "react-resizable-panels";

import { MonacoEditor } from "@/features/Editor/MonacoEditor";
import { PreviewPanel } from "@/features/Preview/PreviewPanel";
import { PreviewFileWatcher } from "@/features/Preview/PreviewFileWatcher";
import { SideBySide } from "@/features/SidebySide";
import { EditorTabs } from "@/features/EditorTabs";
import { LoadFileContent } from "@/features/Editor/LoadFileContent";
import { EditorSave } from "@/features/Editor/EditorSaveHandler";
import { FileExplorer } from "@/features/FileExplorer";
import { isFileExplorerVisibleAtom, workspaceRootAtom } from "@/features/FileExplorer/store";
import { SettingsDialog } from "@/features/SettingsDialog";

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
import { BranchSelectorDialog } from "@/features/BranchSelector";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { EditorViewMode } from "@/features/EditorViewMode";
import { isKnowledgeGraphFile } from "@/lib/knowledgeGraph";




export default function Editor() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editorState = useAtomValue(editorStateAtom);
  const [viewMode, setViewMode] = useAtom(viewModeAtom);
  const loadFileMetadata = useSetAtom(loadFileMetadataAtom);
  const activeTab = useAtomValue(activeTabAtom);
  const createTab = useSetAtom(createTabAtom);
  const switchTab = useSetAtom(switchTabAtom);
  const [tabs] = useAtom(tabsAtom);
  const [isFileExplorerVisible, setIsFileExplorerVisible] = useAtom(isFileExplorerVisibleAtom);
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const layoutGroupId = workspaceRoot 
    ? `depdok-editor-layout-${workspaceRoot.replace(/[^a-zA-Z0-9]/g, '_')}` 
    : 'depdok-editor-layout-default';
  const fileExplorerPanelRef = useRef<ImperativePanelHandle>(null);

  const [showSettings, setShowSettings] = useState(false);

  // Initialize global shortcuts (e.g. Cmd+B to toggle explorer)
  useGlobalShortcuts();

  const { handleContentChange: handleSaveContent } = useAutoSave();
  const markTabAsSaved = useSetAtom(markTabAsSavedAtom);

  const handleExternalReload = (_newContent: string) => {
    if (activeTab) {
      markTabAsSaved(activeTab.id);
    }
  };

  const filePath = searchParams.get("path") || "";
  const isInitialMount = useRef(true);
  const isFirstExplorerSync = useRef(true);

  // Reset first sync flag when workspaceRoot changes (e.g. on mount or when loading new project layout)
  useEffect(() => {
    isFirstExplorerSync.current = true;
  }, [workspaceRoot]);

  // Control panel collapse/expand
  useEffect(() => {
    if (isFirstExplorerSync.current) {
      isFirstExplorerSync.current = false;
      return;
    }
    if (fileExplorerPanelRef.current) {
      if (isFileExplorerVisible) {
        fileExplorerPanelRef.current.expand();
      } else {
        fileExplorerPanelRef.current.collapse();
      }
    }
  }, [isFileExplorerVisible]);

  // Sync Active Tab -> URL
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (activeTab && activeTab.filePath !== filePath) {
      navigate(`/editor?path=${encodeURIComponent(activeTab.filePath)}`, { replace: true });
    } else if (!activeTab && tabs.length === 0 && !workspaceRoot) {
      navigate('/home', { replace: true });
    }
  }, [activeTab, filePath, navigate, tabs.length, workspaceRoot]);

  // Sync URL -> Tabs
  useEffect(() => {
    if (!filePath) return;

    const existingTab = tabs.find(t => t.filePath === filePath);

    if (existingTab) {
      if (activeTab?.id !== existingTab.id) {
        switchTab(existingTab.id);
      }
    } else {
      const fileName = filePath.split(/[/\\]/).pop() || "Untitled";
      createTab({ filePath, fileName, switchTo: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath]);

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

  const currentFilePath = activeTab?.filePath;

  useEffect(() => {
    if (currentFilePath && isKnowledgeGraphFile(currentFilePath) && viewMode !== 'preview-only') {
      setViewMode('preview-only');
    }
  }, [currentFilePath, viewMode, setViewMode]);

  if (!currentFilePath && !workspaceRoot) {
    return null;
  }

  // Format breadcrumbs path: relative to workspaceRoot split by arrows
  const getBreadcrumbs = (): string[] => {
    if (!currentFilePath) return [];
    let relPath = currentFilePath;
    if (workspaceRoot && currentFilePath.startsWith(workspaceRoot)) {
      relPath = currentFilePath.slice(workspaceRoot.length);
    }
    relPath = relPath.replace(/^[/\\]+/, '');
    return relPath.split(/[/\\]/);
  };

  return (
    <>
      <FileSearchDialog />
      <ContentSearchDialog />
      <BranchSelectorDialog />
      <EditorSave />
      {/* <EditorViewMode /> */}

      {/* Main Body Workspace Container */}
      <div className="w-full h-full flex bg-layout-chrome overflow-hidden">
        {/* 2. Main Content pane with Resizable Sidebar & Editor */}
        <div className="flex-1 h-full min-w-0">
          <PanelGroup direction="horizontal" id="editor-layout" autoSaveId={layoutGroupId}>
            {/* Left Sidebar Pane: Explorer & accordions */}
            <Panel
              ref={fileExplorerPanelRef}
              defaultSize={22}
              minSize={15}
              maxSize={40}
              id="file-explorer"
              collapsible={true}
              collapsedSize={0}
              onCollapse={() => setIsFileExplorerVisible(false)}
              onExpand={() => setIsFileExplorerVisible(true)}
            >
              {isFileExplorerVisible && (
                <div className="h-full bg-layout-chrome flex flex-col select-none">
                  {/* File tree browser */}
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <FileExplorer />
                  </div>
                </div>
              )}
            </Panel>

            {isFileExplorerVisible && (
              <PanelResizeHandle className="w-px bg-border hover:bg-primary/50 transition-colors" />
            )}

            {/* Right Pane: Tabs + Breadcrumbs + Monaco/Preview Panel */}
            <Panel defaultSize={78} id="editor-content">
              <div className="h-full w-full flex flex-col bg-layout-content">
                {currentFilePath ? (
                  <>
                    {/* Row 1: Tab list header */}
                    <div className="h-[35px] border-b border-transparent bg-layout-content shrink-0 flex items-end">
                      <EditorTabs />
                    </div>

                    {/* Row 2: Breadcrumbs path and Preview/Markdown switch */}
                    <div className="h-8 bg-layout-content shrink-0 px-3 flex items-center justify-between">
                      {/* Breadcrumbs */}
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate select-none font-mono">
                        {getBreadcrumbs().map((segment, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            {idx > 0 && <span className="text-muted-foreground/30 font-mono text-[9px]">&gt;</span>}
                            {idx === getBreadcrumbs().length - 1 ? (
                              <span className="font-semibold text-foreground/80 lowercase">{segment}</span>
                            ) : (
                              <span className="hover:text-foreground cursor-pointer lowercase transition-colors">{segment}</span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Segmented view switch control */}
                      <div className="">
                        <EditorViewMode />
                        {/* <button
                          onClick={() => setViewMode('preview-only')}
                          className={cn(
                            "px-2.5 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer",
                            viewMode === 'preview-only' 
                              ? "bg-layout-content text-foreground shadow-xs" 
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => setViewMode('editor-only')}
                          className={cn(
                            "px-2.5 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer",
                            viewMode === 'editor-only' || viewMode === 'side-by-side'
                              ? "bg-layout-content text-foreground shadow-xs" 
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Markdown
                        </button> */}
                      </div>
                    </div>

                    {/* Row 3: Active Document Content with background contrast */}
                    <div className="flex-1 min-h-0 bg-layout-content relative">
                      <LoadFileContent filePath={currentFilePath} onMetadataLoad={loadFileMetadata}>
                        {(initialContent) => (
                          <div className="w-full h-full bg-layout-content">
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
                                    filePath={currentFilePath}
                                    editable={true}
                                    onContentChange={handleSaveContent}
                                  />
                                )}
                              </PreviewFileWatcher>
                            )}
                          </div>
                        )}
                      </LoadFileContent>
                    </div>
                  </>
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center bg-layout-chrome text-muted-foreground p-8">
                    <div className="flex flex-col items-center gap-4 max-w-sm text-center">
                      <img src="/app-icon.png" alt="App Icon" className="w-16 h-16 opacity-20 grayscale" />
                      <p className="text-xs">Select a file from the explorer to start editing or create a new file.</p>
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          </PanelGroup>
        </div>
      </div>

      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </>
  );
}
