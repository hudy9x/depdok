import { CheckCircle2, FolderOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface LocalProviderSettingsProps {
  selectedLocalModel: string;
  isWindows: boolean;
  customModelsDir: string;
  defaultModelsDir: string;
  onOpenModelsFolder: () => void;
  onChooseModelsDir: () => void;
  onResetModelsDir: () => void;
}

export function LocalProviderSettings({
  selectedLocalModel,
  isWindows,
  customModelsDir,
  defaultModelsDir,
  onOpenModelsFolder,
  onChooseModelsDir,
  onResetModelsDir,
}: LocalProviderSettingsProps) {
  const isCustomModelsDirConfigured = customModelsDir.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Selected Model
        </Label>
        {selectedLocalModel ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/40 text-xs font-mono text-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
            <span className="truncate">{selectedLocalModel.split(/[/\\]/).pop()}</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No model selected. Download or pick a GGUF file below.
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={onOpenModelsFolder}
        >
          <FolderOpen className="h-3 w-3" /> Open Models Folder
        </Button>
      </div>

      {isWindows && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Models Storage Location
            </Label>
            <p className="text-xs text-muted-foreground">
              Store GGUF downloads in the default app data folder or choose another location with more disk space.
            </p>
          </div>

          <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-xs">
            <div className="font-medium text-foreground">
              {isCustomModelsDirConfigured ? customModelsDir : "Default (App Data Folder)"}
            </div>
            <div className="mt-1 text-muted-foreground">
              {isCustomModelsDirConfigured
                ? "Custom folder selected"
                : (defaultModelsDir || "Loading default location...")}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={onChooseModelsDir}
            >
              Choose...
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={onResetModelsDir}
              disabled={!isCustomModelsDirConfigured}
            >
              Reset
            </Button>
          </div>

          {isCustomModelsDirConfigured && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
              <div className="font-semibold">Notice:</div>
              <div className="mt-1">
                The models folder has been customized. Existing models must be manually copied to the new folder, or downloaded again.
              </div>
              <div className="mt-1 font-mono text-[11px] break-all text-amber-900/80 dark:text-amber-50/80">
                Default location: {defaultModelsDir || "Loading default location..."}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
