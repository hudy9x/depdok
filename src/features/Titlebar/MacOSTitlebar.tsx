import { useState } from 'react';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Settings
} from 'lucide-react';
import { BsLayoutSidebar, BsLayoutSidebarInset } from 'react-icons/bs';
import { PiTerminalWindowLight, PiTerminalFill } from 'react-icons/pi';

import { Button } from '@/components/ui/button';

import { SettingsDialog } from '@/features/SettingsDialog';
import { workspaceRootAtom, isFileExplorerVisibleAtom } from '@/features/FileExplorer/store';
import { licensePopoverOpenAtom } from '@/stores/license-popover';
import { isTerminalOpenAtom, setIsTerminalOpenAtom } from '@/stores/TerminalStore';

import { MacOSButtons } from './MacOSButtons';
import { TitlebarContainer } from './TitlebarContainer';
import { LLMChatButton } from '@/features/LLMChat';

export function MacOSTitlebar() {
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
      {/* Left Section: window buttons, back/forward arrows, sidebar toggle */}
      <div data-tauri-drag-region="false" className="flex items-center gap-3 pl-3 pr-2 flex-shrink-0">
        <MacOSButtons />

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

        {/* Back Navigation arrow */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => navigate('/home')}
            title="Go Back to Home"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
        </div>


      </div>

      {/* Center Section: Project Name & quick settings dropdown */}
      <div
        data-tauri-drag-region
        className="flex items-center justify-center h-full px-4 flex-1 min-w-0 overflow-hidden cursor-default"
      >
        <div
          data-tauri-drag-region="false"
          className="flex items-center gap-1 hover:bg-muted/30 px-2.5 py-1 rounded-md text-[12px] text-foreground/80 cursor-pointer select-none transition-colors border border-transparent hover:border-border/30"
          // onClick={() => setShowSettings(true)}
          title="Open Settings"
        >
          <span data-tauri-drag-region="false" className="truncate lowercase max-w-[200px]">
            {workspaceName}
          </span>
          {/* <ChevronDown data-tauri-drag-region="false" className="h-3 w-3 text-muted-foreground" /> */}
        </div>
      </div>

      {/* Right Section: Pro upgrade, terminal, settings */}
      <div data-tauri-drag-region="false" className="flex items-center gap-1 pr-3 flex-shrink-0">
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
            <PiTerminalFill className="!h-4.5 !w-4.5" />
          ) : (
            <PiTerminalWindowLight className="!h-4.5 !w-4.5" />
          )}
        </Button>

        {/* AI Chat Button */}
        <LLMChatButton />

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

        {/* Dialog Renders */}
        <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
      </div>
    </TitlebarContainer>
  );
}
