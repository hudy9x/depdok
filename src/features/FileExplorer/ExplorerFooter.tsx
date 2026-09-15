import { useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { Settings, X } from "lucide-react";
import { AiOutlineAlert } from "react-icons/ai";
import { PiStarOfDavid } from "react-icons/pi";

import { Button } from "@/components/ui/button";
import { licensePopoverOpenAtom } from "@/stores/license-popover";
import { isLicensedAtom } from "@/stores/license";
import { LLMChat2Button } from "@/features/LLMChat2";
import { SettingsDialog } from "@/features/SettingsDialog";
import { Progress } from "@/components/ui/progress";
import { cancelIndexingAtom, indexingProgressAtom } from "./indexing";

export function ExplorerFooter() {
  const setLicenseOpen = useSetAtom(licensePopoverOpenAtom);
  const isLicensed = useAtomValue(isLicensedAtom);
  const [showSettings, setShowSettings] = useState(false);
  const indexingProgress = useAtomValue(indexingProgressAtom);
  const cancelIndexing = useSetAtom(cancelIndexingAtom);
  const progressPercent = indexingProgress
    ? (indexingProgress.completed / indexingProgress.total) * 100
    : 0;
  const currentFileName = indexingProgress?.currentPath?.split(/[/\\]/).pop();

  return (
    <div className="border-t border-border/40 bg-layout-chrome flex-shrink-0 select-none">
      {indexingProgress && (
        <div className="px-2 pt-2 pb-1.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="truncate">
              {indexingProgress.status === "cancelling"
                ? "Cancelling indexing…"
                : "Indexing"}
              {currentFileName ? ` · ${currentFileName}` : ""}
            </span>
            <span className="shrink-0">
              {indexingProgress.completed}/{indexingProgress.total}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Progress value={progressPercent} className="h-1.5" />
            <button
              type="button"
              aria-label="Cancel indexing"
              title="Cancel indexing"
              disabled={indexingProgress.status === "cancelling"}
              onClick={() => cancelIndexing()}
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between px-2 pt-1.5 pb-2.5">
        <div className="flex items-center gap-1">
          {/* Upgrade to Pro / License Status */}
          <Button
            data-tauri-drag-region="false"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            onClick={() => setLicenseOpen(true)}
            title={isLicensed ? "Pro License Active" : "Upgrade to Pro License"}
          >
            {isLicensed ? (
              <PiStarOfDavid
                data-tauri-drag-region="false"
                className="!h-4.5 !w-4.5 text-amber-500"
              />
            ) : (
              <AiOutlineAlert
                data-tauri-drag-region="false"
                className="!h-4 !w-4 text-red-500 hover:text-red-600"
              />
            )}
          </Button>

          {/* AI Chat v1 */}
          {/* <div data-tauri-drag-region="false">
          <LLMChatButton />
        </div> */}

          {/* AI Chat v2 (Rig Tool Calling) */}
          <div data-tauri-drag-region="false">
            <LLMChat2Button />
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
    </div>
  );
}
