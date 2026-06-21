import { useState } from 'react';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronDown,
  ChevronLeft, 
  Settings
} from 'lucide-react';
import { BsLayoutSidebar, BsLayoutSidebarInset } from 'react-icons/bs';
import { VscLayoutPanel, VscLayoutPanelOff } from 'react-icons/vsc';

import { Button } from '@/components/ui/button';

import { SettingsDialog } from '@/features/SettingsDialog';
import { workspaceRootAtom, isFileExplorerVisibleAtom } from '@/features/FileExplorer/store';
import { licensePopoverOpenAtom } from '@/stores/license-popover';
import { isTerminalOpenAtom, setIsTerminalOpenAtom } from '@/stores/TerminalStore';

import { TitlebarContainer } from './TitlebarContainer';
import { WindowsButtons } from './WindowsButtons';

export function WindowsTitlebar() {
  const navigate = useNavigate();
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const [isFileExplorerVisible, setIsFileExplorerVisible] = useAtom(isFileExplorerVisibleAtom);
  const setLicenseOpen = useSetAtom(licensePopoverOpenAtom);
  const isTerminalOpen = useAtomValue(isTerminalOpenAtom);
  const setIsTerminalOpen = useSetAtom(setIsTerminalOpenAtom);

  const [showSettings, setShowSettings] = useState(false);

  const workspaceName = workspaceRoot 
    ? workspaceRoot.split(/[/\\]/).pop() || 'workspace' 
    : 'depdok';

  return (
    <TitlebarContainer>
      {/* Left Section: app icon, back/forward arrows, sidebar toggle */}
      <div data-tauri-drag-region="false" className="flex items-center gap-2 pl-3 flex-shrink-0">
        <img src="/app-icon.png" alt="App Icon" className="w-4 h-4 pointer-events-none mr-1.5" />
        
        {/* Back Navigation arrow */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => navigate('/home')}
            title="Go Back to Home"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Sidebar Explorer Toggle */}
        {workspaceRoot && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer ml-1"
            onClick={() => setIsFileExplorerVisible(!isFileExplorerVisible)}
            title={isFileExplorerVisible ? "Collapse Sidebar (Cmd+B)" : "Expand Sidebar (Cmd+B)"}
          >
            {isFileExplorerVisible ? (
              <BsLayoutSidebarInset className="h-3.5 w-3.5" />
            ) : (
              <BsLayoutSidebar className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>

      {/* Center Section: Project Name & quick settings dropdown */}
      <div 
        data-tauri-drag-region 
        className="flex items-center justify-center h-full px-4 flex-1 min-w-0 overflow-hidden cursor-default"
      >
        <div 
          data-tauri-drag-region="false"
          className="flex items-center gap-1 hover:bg-muted/30 px-2.5 py-1 rounded-md text-[12px] font-semibold text-foreground/80 cursor-pointer select-none transition-colors border border-transparent hover:border-border/30"
          onClick={() => setShowSettings(true)}
          title="Open Settings"
        >
          <span data-tauri-drag-region="false" className="truncate lowercase max-w-[200px]">
            {workspaceName}
          </span>
          <ChevronDown data-tauri-drag-region="false" className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>

      {/* Right Section: Pro upgrade, terminal, settings, and Windows system controls */}
      <div data-tauri-drag-region="false" className="flex h-full items-center flex-shrink-0 gap-3.5">
        <div className="flex items-center gap-3.5">
          {/* Upgrade to Pro button */}
          <button
            onClick={() => setLicenseOpen(true)}
            className="text-muted-foreground hover:text-foreground text-xs cursor-pointer select-none transition-colors"
            title="Upgrade to Pro License"
          >
            Upgrade to Pro
          </button>

          {/* Terminal Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 cursor-pointer transition-colors ${
              isTerminalOpen
                ? 'text-primary hover:text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setIsTerminalOpen(!isTerminalOpen)}
            title={`${isTerminalOpen ? 'Hide' : 'Show'} Terminal (Ctrl+\`)`}
          >
            {isTerminalOpen ? (
              <VscLayoutPanel className="h-4 w-4" />
            ) : (
              <VscLayoutPanelOff className="h-4 w-4" />
            )}
          </Button>

          {/* Settings Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Dialog Renders */}
        <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />

        {/* Windows OS native look window controls */}
        <WindowsButtons />
      </div>
    </TitlebarContainer>
  );
}
