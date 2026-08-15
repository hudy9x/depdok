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
import { RecentFoldersDialog } from '@/features/RecentFoldersDialog';
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
  const [showRecentFolders, setShowRecentFolders] = useState(false);

  return (
    <TitlebarContainer>
      {/* Left Section: window buttons, back/forward arrows, sidebar toggle */}
      <div className="pointer-events-auto flex items-center gap-2.5 pl-3 pr-2 flex-shrink-0 h-full">
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

      {/* Center Section: Transparent drag area so tabs underneath can receive events */}
      <div
        data-tauri-drag-region
        className="flex-1 min-w-0 h-full pointer-events-none"
      />

      {/* Right Section: Pro upgrade, terminal, settings */}
      <div className="pointer-events-auto flex items-center gap-1 pr-3 flex-shrink-0 h-full">
        {/* Upgrade to Pro button */}
        <button
          onClick={() => setLicenseOpen(true)}
          className="text-muted-foreground hover:text-foreground text-xs cursor-pointer select-none transition-colors px-1.5 py-1"
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
        <RecentFoldersDialog open={showRecentFolders} onOpenChange={setShowRecentFolders} />
      </div>
    </TitlebarContainer>
  );
}
