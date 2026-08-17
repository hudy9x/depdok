import { useAtom, useAtomValue } from 'jotai';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
} from 'lucide-react';
import { BsLayoutSidebar, BsLayoutSidebarInset } from 'react-icons/bs';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { workspaceRootAtom, isFileExplorerVisibleAtom } from '@/features/FileExplorer/store';
import { usePlatform } from '@/lib/platform';

import { MacOSButtons } from './MacOSButtons';
import { WindowsButtons } from './WindowsButtons';
import { TitlebarContainer } from './TitlebarContainer';

export { HomeTitlebar } from './HomeTitlebar';

export function Titlebar() {
  const { isMacOS } = usePlatform();
  const navigate = useNavigate();
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const [isFileExplorerVisible, setIsFileExplorerVisible] = useAtom(isFileExplorerVisibleAtom);

  return (
    <TitlebarContainer>
      {/* Left Section: window controls / app icon, sidebar toggle, back arrow */}
      <div
        data-tauri-drag-region
        className={cn(
          "pointer-events-auto flex items-center pt-1.5 flex-shrink-0 h-full bg-layout-chrome",
          isMacOS
            ? "pl-3 pr-2 gap-2.5"
            : (isFileExplorerVisible ? "pl-3 pr-2 gap-2" : "pl-2.5 pr-0")
        )}
      >
        {isMacOS ? (
          <MacOSButtons />
        ) : (
          <div className="relative flex items-center justify-center w-5 h-5">
            {workspaceRoot && !isFileExplorerVisible ? (
              <button
                data-tauri-drag-region="false"
                type="button"
                className="group relative flex items-center justify-center w-5 h-5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => setIsFileExplorerVisible(true)}
                title="Expand Sidebar (Cmd+B)"
              >
                <img
                  data-tauri-drag-region="false"
                  src="/app-icon.png"
                  alt="App Icon"
                  className="w-4 h-4 pointer-events-none transition-opacity duration-150 group-hover:opacity-0"
                />
                <BsLayoutSidebar
                  data-tauri-drag-region="false"
                  className="h-3.5 w-3.5 absolute inset-0 m-auto opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                />
              </button>
            ) : (
              <img
                data-tauri-drag-region="false"
                src="/app-icon.png"
                alt="App Icon"
                className="w-4 h-4 pointer-events-none"
              />
            )}
          </div>
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
        {(isMacOS || isFileExplorerVisible) && (
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
        )}

        {/* Sidebar Explorer Toggle (Windows layout: right of back button) */}
        {workspaceRoot && !isMacOS && isFileExplorerVisible && (
          <Button
            data-tauri-drag-region="false"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer ml-1"
            onClick={() => setIsFileExplorerVisible(!isFileExplorerVisible)}
            title="Collapse Sidebar (Cmd+B)"
          >
            <BsLayoutSidebarInset data-tauri-drag-region="false" className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Center Section: Transparent drag area so tabs underneath can receive events */}
      <div
        data-tauri-drag-region
        className="flex-1 min-w-0 h-full pointer-events-none"
      />

      {/* Right Section: Windows controls */}
      {!isMacOS && (
        <div
          data-tauri-drag-region
          className="pointer-events-auto flex h-full items-center flex-shrink-0 bg-layout-chrome"
        >
          <WindowsButtons />
        </div>
      )}
    </TitlebarContainer>
  );
}
