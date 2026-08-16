import { useEffect, useState } from 'react';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { platform } from '@tauri-apps/plugin-os';
import {
  ArrowLeft,
  ChevronLeft,
  Settings
} from 'lucide-react';
import { BsLayoutSidebar, BsLayoutSidebarInset } from 'react-icons/bs';
import { PiTerminalWindowLight, PiTerminalFill } from 'react-icons/pi';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SettingsDialog } from '@/features/SettingsDialog';
import { RecentFoldersDialog } from '@/features/RecentFoldersDialog';
import { workspaceRootAtom, isFileExplorerVisibleAtom } from '@/features/FileExplorer/store';
import { licensePopoverOpenAtom } from '@/stores/license-popover';
import { isTerminalOpenAtom, setIsTerminalOpenAtom } from '@/stores/TerminalStore';
import { LLMChatButton } from '@/features/LLMChat';

import { MacOSButtons } from './MacOSButtons';
import { WindowsButtons } from './WindowsButtons';
import { TitlebarContainer } from './TitlebarContainer';

export { HomeTitlebar } from './HomeTitlebar';

export function Titlebar() {
  const [currentPlatform, setCurrentPlatform] = useState<string>('');
  const navigate = useNavigate();
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const [isFileExplorerVisible, setIsFileExplorerVisible] = useAtom(isFileExplorerVisibleAtom);
  const setLicenseOpen = useSetAtom(licensePopoverOpenAtom);
  const isTerminalOpen = useAtomValue(isTerminalOpenAtom);
  const setIsTerminalOpen = useSetAtom(setIsTerminalOpenAtom);

  const [showSettings, setShowSettings] = useState(false);
  const [showRecentFolders, setShowRecentFolders] = useState(false);

  useEffect(() => {
    try {
      const platformName = platform();
      setCurrentPlatform(platformName);
    } catch {
      setCurrentPlatform('macos');
    }
  }, []);

  if (!currentPlatform) {
    return null;
  }

  const isMacOS = currentPlatform === 'macos';

  return (
    <TitlebarContainer>
      {/* Left Section: window controls / app icon, sidebar toggle, back arrow */}
      <div
        data-tauri-drag-region
        className={cn(
          "pointer-events-auto flex items-center pt-1.5 pl-3 pr-2 flex-shrink-0 h-full",
          isMacOS ? "gap-2.5" : "gap-2"
        )}
      >
        {isMacOS ? (
          <MacOSButtons />
        ) : (
          <img
            data-tauri-drag-region="false"
            src="/app-icon.png"
            alt="App Icon"
            className="w-4 h-4 pointer-events-none mr-1.5"
          />
        )}

        {/* Sidebar Explorer Toggle (macOS layout: right of traffic lights) */}
        {workspaceRoot && isMacOS && (
          <Button
            data-tauri-drag-region="false"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer ml-1"
            onClick={() => setIsFileExplorerVisible(!isFileExplorerVisible)}
            title={isFileExplorerVisible ? "Collapse Sidebar (Cmd+B)" : "Expand Sidebar (Cmd+B)"}
          >
            {isFileExplorerVisible ? (
              <BsLayoutSidebarInset data-tauri-drag-region="false" className="h-3.5 w-3.5" />
            ) : (
              <BsLayoutSidebar data-tauri-drag-region="false" className="h-3.5 w-3.5" />
            )}
          </Button>
        )}

        {/* Back Navigation arrow */}
        <div data-tauri-drag-region="false" className="flex items-center gap-0.5">
          <Button
            data-tauri-drag-region="false"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => navigate('/home')}
            title="Go Back to Home"
          >
            {isMacOS ? (
              <ArrowLeft data-tauri-drag-region="false" className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft data-tauri-drag-region="false" className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        {/* Sidebar Explorer Toggle (Windows layout: right of back button) */}
        {workspaceRoot && !isMacOS && (
          <Button
            data-tauri-drag-region="false"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer ml-1"
            onClick={() => setIsFileExplorerVisible(!isFileExplorerVisible)}
            title={isFileExplorerVisible ? "Collapse Sidebar (Cmd+B)" : "Expand Sidebar (Cmd+B)"}
          >
            {isFileExplorerVisible ? (
              <BsLayoutSidebarInset data-tauri-drag-region="false" className="h-3.5 w-3.5" />
            ) : (
              <BsLayoutSidebar data-tauri-drag-region="false" className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>

      {/* Center Section: Transparent drag area so tabs underneath can receive events */}
      <div
        data-tauri-drag-region
        className="flex-1 min-w-0 h-full pointer-events-none"
      />

      {/* Right Section: Pro upgrade, terminal, AI chat, settings, Windows controls */}
      <div
        data-tauri-drag-region
        className={cn(
          "pointer-events-auto flex h-full items-center pt-1.5 flex-shrink-0",
          isMacOS ? "gap-1 pr-3" : "gap-3.5"
        )}
      >
        <div data-tauri-drag-region className={cn("flex items-center", isMacOS ? "gap-1" : "gap-3.5")}>
          {/* Upgrade to Pro button */}
          <button
            data-tauri-drag-region="false"
            onClick={() => setLicenseOpen(true)}
            className="text-muted-foreground hover:text-foreground text-xs cursor-pointer select-none transition-colors px-1.5 py-1"
            title="Upgrade to Pro License"
          >
            Upgrade to Pro
          </button>

          {/* Terminal Toggle Button */}
          <Button
            data-tauri-drag-region="false"
            variant="ghost"
            size="icon"
            className={`h-7 w-7 cursor-pointer transition-colors ${isTerminalOpen
              ? 'text-primary hover:text-primary'
              : 'text-muted-foreground hover:text-foreground'
              }`}
            onClick={() => setIsTerminalOpen(!isTerminalOpen)}
            title={`${isTerminalOpen ? 'Hide' : 'Show'} Terminal (Ctrl+\`)`}
          >
            {isTerminalOpen ? (
              <PiTerminalFill data-tauri-drag-region="false" className="!h-4.5 !w-4.5" />
            ) : (
              <PiTerminalWindowLight data-tauri-drag-region="false" className="!h-4.5 !w-4.5" />
            )}
          </Button>

          {/* AI Chat Button */}
          <div data-tauri-drag-region="false">
            <LLMChatButton />
          </div>

          {/* Settings Button */}
          <Button
            data-tauri-drag-region="false"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            <Settings data-tauri-drag-region="false" className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Dialog Renders */}
        <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
        <RecentFoldersDialog open={showRecentFolders} onOpenChange={setShowRecentFolders} />

        {/* Windows OS native look window controls */}
        {!isMacOS && <WindowsButtons />}
      </div>
    </TitlebarContainer>
  );
}
