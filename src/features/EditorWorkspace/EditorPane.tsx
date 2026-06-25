import * as React from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Pane, activePaneIdAtom, focusPaneAtom } from '@/stores/PaneStore';
import { EditorTabs } from '@/features/EditorTabs';
import { SplitPaneButton } from './SplitPaneButton';
import { EditorBreadcrumbs } from '@/features/Editor/EditorBreadcrumbs';
import { EditorViewMode } from '@/features/EditorViewMode';
import { LoadFileContent } from '@/features/Editor/LoadFileContent';
import { SideBySide } from '@/features/SidebySide';
import { MonacoEditor } from '@/features/Editor/MonacoEditor';
import { PreviewPanel } from '@/features/Preview/PreviewPanel';
import { PreviewFileWatcher } from '@/features/Preview/PreviewFileWatcher';
import { getMonacoLanguage } from '@/lib/utils/getMonacoLanguage';
import { useAutoSave } from '@/features/Editor/useAutoSave';
import { markTabAsSavedAtom } from '@/stores/TabStore';

interface EditorPaneProps {
  pane: Pane;
}

export function EditorPane({ pane }: EditorPaneProps): React.JSX.Element {
  const activePaneId = useAtomValue(activePaneIdAtom);
  const focusPane = useSetAtom(focusPaneAtom);
  const isFocused = activePaneId === pane.id;

  const activeTab = pane.tabs.find((t) => t.id === pane.activeTabId) || null;
  const currentFilePath = activeTab?.filePath;

  const { handleContentChange } = useAutoSave();
  const markTabAsSaved = useSetAtom(markTabAsSavedAtom);

  const handleExternalReload = () => {
    if (activeTab) {
      markTabAsSaved({ tabId: activeTab.id, paneId: pane.id });
    }
  };

  const handlePaneClick = () => {
    if (activePaneId !== pane.id) {
      focusPane(pane.id);
    }
  };

  return (
    <div
      onClick={handlePaneClick}
      className={[
        "flex-1 flex flex-col min-w-0 min-h-0 bg-layout-content relative h-full w-full border-r last:border-r-0 border-border/40",
        isFocused ? "outline-[1px] outline-primary/30 outline-offset-[-1px]" : "",
      ].join(" ")}
    >
      {currentFilePath ? (
        <>
          {/* Row 1: Tab list header + split buttons */}
          <div 
            className={[
              "h-[35px] border-b shrink-0 flex items-end justify-between transition-colors",
              isFocused ? "border-border/60 bg-layout-content" : "border-border/30 bg-muted/20"
            ].join(" ")}
          >
            <div className="flex-1 min-w-0 overflow-x-auto scrollbar-none">
              <EditorTabs paneId={pane.id} />
            </div>
            <SplitPaneButton paneId={pane.id} />
          </div>

          {/* Row 2: Breadcrumbs path and Preview/Markdown switch */}
          <div className="h-8 bg-layout-content shrink-0 px-3 flex items-center justify-between border-b border-border/20 select-none">
            <EditorBreadcrumbs filePath={currentFilePath} />
            <EditorViewMode paneId={pane.id} filePath={currentFilePath} viewMode={pane.viewMode} />
          </div>

          {/* Row 3: Active Document Content */}
          <div className="flex-1 min-h-0 bg-layout-content relative">
            <LoadFileContent
              filePath={currentFilePath}
              isDeleted={activeTab.isDeleted}
            >
              {(initialContent) => {
                const language = getMonacoLanguage(activeTab.fileExtension);
                const localHandleChange = (val: string) => {
                  handleContentChange(val, {
                    filePath: currentFilePath,
                    tabId: activeTab.id,
                    isDeleted: activeTab.isDeleted,
                    paneId: pane.id,
                  });
                };

                return (
                  <div className="w-full h-full bg-layout-content">
                    {pane.viewMode === 'side-by-side' && (
                      <SideBySide
                        initialContent={initialContent}
                        enableFileWatcher={isFocused}
                        lineNumber={activeTab.lineNumber}
                        filePath={currentFilePath}
                        tabId={activeTab.id}
                        isDeleted={activeTab.isDeleted}
                        onContentChange={localHandleChange}
                      />
                    )}

                    {pane.viewMode === 'editor-only' && (
                      <MonacoEditor
                        initialContent={initialContent}
                        language={language}
                        enableFileWatcher={isFocused}
                        lineNumber={activeTab.lineNumber}
                        filePath={currentFilePath}
                        tabId={activeTab.id}
                        isDeleted={activeTab.isDeleted}
                        onContentChange={localHandleChange}
                      />
                    )}

                    {pane.viewMode === 'preview-only' && (
                      <PreviewFileWatcher
                        content={initialContent}
                        enableFileWatcher={isFocused}
                        filePath={currentFilePath}
                        onContentReload={handleExternalReload}
                      >
                        {(content) => (
                          <PreviewPanel
                            content={content}
                            fileExtension={activeTab.fileExtension}
                            filePath={currentFilePath}
                            editable={true}
                            onContentChange={localHandleChange}
                          />
                        )}
                      </PreviewFileWatcher>
                    )}
                  </div>
                );
              }}
            </LoadFileContent>
          </div>
        </>
      ) : (
        <div 
          onClick={handlePaneClick}
          className="h-full w-full flex flex-col items-center justify-center bg-layout-chrome text-muted-foreground p-8"
        >
          <div className="flex flex-col items-center gap-4 max-w-sm text-center">
            <img src="/app-icon.png" alt="App Icon" className="w-16 h-16 opacity-10 grayscale" />
            <p className="text-xs">No active file in this pane.</p>
          </div>
        </div>
      )}
    </div>
  );
}
