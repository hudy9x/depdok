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
import { markAsSavedAtom, clearLiveFileWriterAtom } from '@/stores/EditorStore';

/**
 * Maximum number of tabs kept alive in DOM at any time (LRU eviction).
 * Tabs beyond this limit are unmounted; re-opening them cold-starts (~300ms).
 * Increase for faster switching at the cost of more memory.
 */
const MAX_KEEP_ALIVE = 8;

interface EditorPaneProps {
  pane: Pane;
}

interface TabContentProps {
  pane: Pane;
  tabId: string;
  isTabActive: boolean;
  isFocused: boolean;
  handleContentChange: ReturnType<typeof useAutoSave>['handleContentChange'];
  markAsSaved: () => void;
}

/** Inner content for a single kept-alive tab slot. */
function TabContent({
  pane,
  tabId,
  isTabActive,
  isFocused,
  handleContentChange,
  markAsSaved,
}: TabContentProps) {
  const tab = pane.tabs.find((t) => t.id === tabId);
  if (!tab) return null;

  const currentFilePath = tab.filePath;
  const language = getMonacoLanguage(tab.fileExtension);

  const localHandleChange = (val: string) => {
    handleContentChange(val, {
      filePath: currentFilePath,
      tabId: tab.id,
      isDeleted: tab.isDeleted,
      paneId: pane.id,
    });
  };

  const handleExternalReload = () => {
    markAsSaved();
  };

  // Only enable file watcher for the active + focused tab to avoid
  // background IPC noise from hidden tabs.
  const enableWatcher = isTabActive && isFocused;

  return (
    <LoadFileContent
      filePath={currentFilePath}
      isDeleted={tab.isDeleted}
      paneId={pane.id}
    >
      {(initialContent) => (
        <div className="w-full h-full bg-layout-content">
          {pane.viewMode === 'side-by-side' && (
            <SideBySide
              initialContent={initialContent}
              enableFileWatcher={enableWatcher}
              lineNumber={tab.lineNumber}
              filePath={currentFilePath}
              tabId={tab.id}
              isDeleted={tab.isDeleted}
              onContentChange={localHandleChange}
              isTabActive={isTabActive}
            />
          )}

          {pane.viewMode === 'editor-only' && (
            <MonacoEditor
              initialContent={initialContent}
              language={language}
              enableFileWatcher={enableWatcher}
              lineNumber={tab.lineNumber}
              filePath={currentFilePath}
              tabId={tab.id}
              isDeleted={tab.isDeleted}
              onContentChange={localHandleChange}
              isTabActive={isTabActive}
            />
          )}

          {pane.viewMode === 'preview-only' && (
            <PreviewFileWatcher
              content={initialContent}
              enableFileWatcher={enableWatcher}
              filePath={currentFilePath}
              onContentReload={handleExternalReload}
            >
              {(content) => (
                <PreviewPanel
                  content={content}
                  fileExtension={tab.fileExtension}
                  filePath={currentFilePath}
                  editable={true}
                  onContentChange={localHandleChange}
                  isTabActive={isTabActive}
                />
              )}
            </PreviewFileWatcher>
          )}
        </div>
      )}
    </LoadFileContent>
  );
}

export function EditorPane({ pane }: EditorPaneProps): React.JSX.Element {
  const activePaneId = useAtomValue(activePaneIdAtom);
  const focusPane = useSetAtom(focusPaneAtom);
  const isFocused = activePaneId === pane.id;

  const activeTab = pane.tabs.find((t) => t.id === pane.activeTabId) || null;
  const currentFilePath = activeTab?.filePath;

  const { handleContentChange } = useAutoSave();
  const markAsSaved = useSetAtom(markAsSavedAtom);
  const clearLiveFileWriter = useSetAtom(clearLiveFileWriterAtom);

  /**
   * LRU keep-alive tracking.
   * visitedRef: Set of tab IDs that have been mounted (and should stay alive).
   * lruRef: Array of tab IDs in access order (oldest first, newest last).
   */
  const visitedRef = React.useRef<Set<string>>(new Set());
  const lruRef = React.useRef<string[]>([]);

  // When the view mode changes, clear the writer-pane tag so the newly-mounted
  // view component (e.g. preview after editing in editor mode) can pick up the
  // latest live content even though it was written by this same pane.
  React.useEffect(() => {
    if (currentFilePath) {
      clearLiveFileWriter(currentFilePath);
    }
  }, [pane.viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark the active tab as visited and update LRU order.
  if (pane.activeTabId) {
    const id = pane.activeTabId;

    // Move to end of LRU list (most recently used)
    const idx = lruRef.current.indexOf(id);
    if (idx !== -1) {
      lruRef.current.splice(idx, 1);
    }
    lruRef.current.push(id);

    // Mount this tab
    visitedRef.current.add(id);

    // Evict oldest entries beyond MAX_KEEP_ALIVE
    while (visitedRef.current.size > MAX_KEEP_ALIVE) {
      const oldest = lruRef.current.shift();
      if (oldest) {
        visitedRef.current.delete(oldest);
      }
    }
  }

  // When a tab is closed, remove it from visited + LRU so its DOM is GC'd.
  const currentTabIds = new Set(pane.tabs.map((t) => t.id));
  for (const id of Array.from(visitedRef.current)) {
    if (!currentTabIds.has(id)) {
      visitedRef.current.delete(id);
      const idx = lruRef.current.indexOf(id);
      if (idx !== -1) lruRef.current.splice(idx, 1);
    }
  }

  const handlePaneClick = () => {
    if (activePaneId !== pane.id) {
      focusPane(pane.id);
    }
  };

  // The visited snapshot for this render
  const visitedSnapshot = Array.from(visitedRef.current);

  return (
    <div
      onClick={handlePaneClick}
      className={[
        "flex-1 flex flex-col min-w-0 min-h-0 bg-layout-content relative h-full w-full border-r last:border-r-0 border-border/40",
        isFocused ? "is-focused" : "",
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

          {/* Row 3: Keep-alive tab containers */}
          <div className="flex-1 min-h-0 bg-layout-content relative">
            {visitedSnapshot.map((tabId) => {
              const isTabActive = tabId === pane.activeTabId;
              return (
                <div
                  key={tabId}
                  style={{ display: isTabActive ? 'block' : 'none' }}
                  className="absolute inset-0"
                >
                  <TabContent
                    pane={pane}
                    tabId={tabId}
                    isTabActive={isTabActive}
                    isFocused={isFocused}
                    handleContentChange={handleContentChange}
                    markAsSaved={markAsSaved}
                  />
                </div>
              );
            })}
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
