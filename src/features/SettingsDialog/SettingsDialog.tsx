import { useAtom } from "jotai";
import { useEffect } from "react";
import { useTheme } from "next-themes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { autoSaveEnabledAtom, autoSaveDelayAtom, themeAtom } from "@/stores/SettingsStore";
import { Monitor, Moon, Sun } from "lucide-react";
import { AssetsFolderSetting } from "./AssetsFolderSetting";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [autoSaveEnabled, setAutoSaveEnabled] = useAtom(autoSaveEnabledAtom);
  const [autoSaveDelay, setAutoSaveDelay] = useAtom(autoSaveDelayAtom);
  const [selectedTheme, setSelectedTheme] = useAtom(themeAtom);
  const { setTheme } = useTheme();

  // Sync theme changes with next-themes
  useEffect(() => {
    setTheme(selectedTheme);
  }, [selectedTheme, setTheme]);

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
          {/* Theme Switcher */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-save">Theme</Label>
              <p className="text-sm text-muted-foreground">
                Select your favorite theme
              </p>
            </div>
            <RadioGroup
              value={selectedTheme}
              onValueChange={(value) => setSelectedTheme(value as 'light' | 'dark' | 'system')}
              className="grid grid-cols-3 gap-0 bg-muted p-1 rounded-md text-muted-foreground"
            >
              <div className="">
                <RadioGroupItem
                  value="light"
                  id="light"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="light"
                  className="flex items-center rounded-sm justify-center p-2 hover:text-accent-foreground peer-data-[state=checked]:bg-background peer-data-[state=checked]:text-foreground peer-data-[state=checked]:shadow-sm cursor-pointer"
                >
                  <Sun className="w-4 h-4" />
                </Label>
              </div>
              <div>
                <RadioGroupItem
                  value="dark"
                  id="dark"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="dark"
                  className="flex items-center rounded-sm justify-center p-2 hover:text-accent-foreground peer-data-[state=checked]:bg-background peer-data-[state=checked]:text-foreground peer-data-[state=checked]:shadow-sm cursor-pointer"
                >
                  <Moon className="w-4 h-4" />
                </Label>
              </div>
              <div>
                <RadioGroupItem
                  value="system"
                  id="system"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="system"
                  className="flex items-center rounded-sm justify-center p-2 hover:text-accent-foreground peer-data-[state=checked]:bg-background peer-data-[state=checked]:text-foreground peer-data-[state=checked]:shadow-sm cursor-pointer"
                >
                  <Monitor className="w-4 h-4" />
                </Label>
              </div>
            </RadioGroup>
          </div>


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

          {/* Assets Folder Setting */}
          <AssetsFolderSetting />
        </div>
      </DialogContent>
    </Dialog>
  );
}
