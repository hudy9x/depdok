import { useSearchParams, useNavigate } from "react-router-dom";
import { useAtom, useSetAtom, useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";

import { FileExplorer } from "@/features/FileExplorer";
import { isFileExplorerVisibleAtom, workspaceRootAtom } from "@/features/FileExplorer/store";
import { SettingsDialog } from "@/features/SettingsDialog";
import { PanelSectionGroup, PanelSectionItem, PanelSectionHandle } from "@/components/ui/panel-section";

import { EditorWorkspace } from "@/features/EditorWorkspace";

import {
  activeTabAtom,
  tabsAtom,
  switchTabAtom,
  createTabAtom,
} from "@/stores/TabStore";

import { FileSearchDialog } from "@/features/FileSearchDialog";
import { EditorSave } from "@/features/Editor/EditorSaveHandler";
import { ContentSearchDialog } from "@/features/ContentSearchDialog";
import { BranchSelectorDialog } from "@/features/BranchSelector";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { useWorkspaceWatcher } from "@/hooks/useWorkspaceWatcher";
import { TerminalPanel } from "@/features/Terminal/TerminalPanel";
import {
  setIsTerminalOpenAtom,
  isTerminalOpenAtom,
  terminalPositionAtom,
} from "@/stores/TerminalStore";



export default function Editor() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeTab = useAtomValue(activeTabAtom);
  const createTab = useSetAtom(createTabAtom);
  const switchTab = useSetAtom(switchTabAtom);
  const [tabs] = useAtom(tabsAtom);
  const isFileExplorerVisible = useAtomValue(isFileExplorerVisibleAtom);
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const [showSettings, setShowSettings] = useState(false);
  const setIsTerminalOpen = useSetAtom(setIsTerminalOpenAtom);
  const isTerminalOpen = useAtomValue(isTerminalOpenAtom);
  const terminalPosition = useAtomValue(terminalPositionAtom);

  // Initialize global shortcuts (e.g. Cmd+B to toggle explorer)
  useGlobalShortcuts();

  // Toggle terminal panel with Ctrl+`
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        setIsTerminalOpen(!isTerminalOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTerminalOpen, setIsTerminalOpen]);

  // Watch the workspace for external file system changes
  useWorkspaceWatcher();

  const filePath = searchParams.get("path") || "";
  const isInitialMount = useRef(true);

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

  if (!workspaceRoot) {
    return null;
  }

  const isRight = terminalPosition === 'right';

  return (
    <>
      <FileSearchDialog />
      <ContentSearchDialog />
      <BranchSelectorDialog />
      <EditorSave />
      {/* <EditorViewMode /> */}

      {/* Outer flex wrapper: layout direction changes depending on terminal position */}
      <div className={`w-full h-full flex ${isRight ? 'flex-row' : 'flex-col'} overflow-hidden`}>
        {/* Main Body Workspace Container */}
        <div className="flex-1 min-h-0 min-w-0 flex bg-layout-chrome overflow-hidden">
          {/* 2. Main Content pane with Resizable Sidebar & Editor */}
          <PanelSectionGroup storageKey="depdok-editor-layouts">
            <PanelSectionItem
              id="sidebar"
              visible={isFileExplorerVisible}
              minWidth={180}
              maxWidth={400}
              defaultWidth={240}
              className="bg-layout-chrome flex flex-col select-none"
            >
              <div className="flex-1 min-h-0 overflow-y-auto">
                <FileExplorer />
              </div>
            </PanelSectionItem>

            <PanelSectionHandle
              targetId="sidebar"
              visible={isFileExplorerVisible}
              resizeDirection="right"
              className="bg-border hover:bg-primary/50 transition-colors"
            />

            <PanelSectionItem flex={1} className="bg-layout-content min-w-0 min-h-0">
              <EditorWorkspace />
            </PanelSectionItem>
          </PanelSectionGroup>
        </div>

        {/* Terminal panel — sits at bottom or right of the workspace */}
        <TerminalPanel shortcutHint="Ctrl+`" />
      </div>

      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </>
  );
}
