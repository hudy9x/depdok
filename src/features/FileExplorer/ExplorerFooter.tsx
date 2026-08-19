import { useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Sparkles, Settings } from 'lucide-react';
import { PiTerminalWindowLight, PiTerminalFill } from 'react-icons/pi';

import { Button } from '@/components/ui/button';
import { licensePopoverOpenAtom } from '@/stores/license-popover';
import { isTerminalOpenAtom, setIsTerminalOpenAtom } from '@/stores/TerminalStore';
import { LLMChatButton } from '@/features/LLMChat';
import { SettingsDialog } from '@/features/SettingsDialog';

export function ExplorerFooter() {
  const setLicenseOpen = useSetAtom(licensePopoverOpenAtom);
  const isTerminalOpen = useAtomValue(isTerminalOpenAtom);
  const setIsTerminalOpen = useSetAtom(setIsTerminalOpenAtom);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="flex items-center justify-between px-2 pt-1.5 pb-2.5 border-t border-border/40 bg-layout-chrome flex-shrink-0 select-none">
      <div className="flex items-center gap-1">
        {/* Upgrade to Pro (icon) */}
        <Button
          data-tauri-drag-region="false"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          onClick={() => setLicenseOpen(true)}
          title="Upgrade to Pro License"
        >
          <Sparkles data-tauri-drag-region="false" className="h-4 w-4 text-amber-500/90 hover:text-amber-500" />
        </Button>

        {/* Terminal Toggle */}
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

        {/* AI Chat */}
        <div data-tauri-drag-region="false">
          <LLMChatButton />
        </div>
      </div>

      {/* Settings */}
      <div className="flex items-center">
        <Button
          data-tauri-drag-region="false"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          onClick={() => setShowSettings(true)}
          title="Settings"
        >
          <Settings data-tauri-drag-region="false" className="h-4 w-4" />
        </Button>
      </div>

      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}
