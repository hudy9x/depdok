import { useAtom } from "jotai";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { autoSaveEnabledAtom, autoSaveDelayAtom } from "@/stores/SettingsStore";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [autoSaveEnabled, setAutoSaveEnabled] = useAtom(autoSaveEnabledAtom);
  const [autoSaveDelay, setAutoSaveDelay] = useAtom(autoSaveDelayAtom);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your editor preferences
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Auto-save toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-save">Auto-save</Label>
              <p className="text-sm text-muted-foreground">
                Automatically save changes to file
              </p>
            </div>
            <Switch
              id="auto-save"
              checked={autoSaveEnabled}
              onCheckedChange={setAutoSaveEnabled}
            />
          </div>

          {/* Auto-save delay (only shown when enabled) */}
          {autoSaveEnabled && (
            <div className="space-y-2">
              <Label htmlFor="delay">Auto-save delay</Label>
              <p className="text-sm text-muted-foreground">
                Time to wait before saving ({autoSaveDelay}ms)
              </p>
              <input
                type="range"
                id="delay"
                min="500"
                max="5000"
                step="500"
                value={autoSaveDelay}
                onChange={(e) => setAutoSaveDelay(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
