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
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { useWorkspaceWatcher } from "@/hooks/useWorkspaceWatcher";
import { LLMChat2Panel } from "@/features/LLMChat2";

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

  // Initialize global shortcuts (e.g. Cmd+B to toggle explorer)
  useGlobalShortcuts();

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

  return (
    <>
      <FileSearchDialog />
      <ContentSearchDialog />
      <EditorSave />
      {/* <EditorViewMode /> */}

      {/* Outer flex wrapper: horizontal flex with workspace on left and LLMChat2Panel on right */}
      <div className="w-full h-full flex flex-row overflow-hidden">
        {/* Main Content pane with Resizable Sidebar & Editor */}
        <div className="flex-1 min-h-0 min-w-0 flex bg-layout-chrome overflow-hidden">
          <PanelSectionGroup storageKey="depdok-editor-layouts">
            <PanelSectionItem
              id="sidebar"
              visible={isFileExplorerVisible}
              minWidth={180}
              maxWidth={400}
              defaultWidth={240}
              data-tauri-drag-region
              className="bg-layout-chrome flex flex-col select-none pt-[38px]"
            >
              <div data-tauri-drag-region="false" className="flex-1 min-h-0 overflow-y-auto">
                <FileExplorer />
              </div>
            </PanelSectionItem>

            <PanelSectionHandle
              targetId="sidebar"
              visible={isFileExplorerVisible}
              resizeDirection="right"
              className="bg-transparent group-hover:bg-primary/0 transition-colors"
            />

            <PanelSectionItem flex={1} className="bg-layout-chrome min-w-0 min-h-0">
              <EditorWorkspace />
            </PanelSectionItem>
          </PanelSectionGroup>
        </div>

        {/* AI Chat v2 panel — sits at right of the workspace */}
        <LLMChat2Panel />
      </div>

      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </>
  );
}
