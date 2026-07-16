import { useAtom } from "jotai";
import { plantUmlThemeLightAtom, plantUmlThemeDarkAtom } from "@/stores/SettingsStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PLANTUML_THEMES } from "@/features/PreviewPlantUML/themes";

const AVAILABLE_THEMES = Object.entries(PLANTUML_THEMES).map(([key, value]) => ({
  value: key,
  label: value.label,
}));

export function PlantUmlThemeSetting() {
  const [plantUmlThemeLight, setPlantUmlThemeLight] = useAtom(plantUmlThemeLightAtom);
  const [plantUmlThemeDark, setPlantUmlThemeDark] = useAtom(plantUmlThemeDarkAtom);

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium">PlantUML Native Theme</h4>
        <p className="text-xs text-muted-foreground">
          Select standard themes to use for the native offline PlantUML preview.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="plantuml-theme-light" className="text-xs text-muted-foreground">Light Mode Theme</Label>
          <Select value={plantUmlThemeLight} onValueChange={setPlantUmlThemeLight}>
            <SelectTrigger id="plantuml-theme-light" className="w-full">
              <SelectValue placeholder="Select Light Theme" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {AVAILABLE_THEMES.map((theme) => (
                <SelectItem key={theme.value} value={theme.value}>
                  {theme.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="plantuml-theme-dark" className="text-xs text-muted-foreground">Dark Mode Theme</Label>
          <Select value={plantUmlThemeDark} onValueChange={setPlantUmlThemeDark}>
            <SelectTrigger id="plantuml-theme-dark" className="w-full">
              <SelectValue placeholder="Select Dark Theme" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {AVAILABLE_THEMES.map((theme) => (
                <SelectItem key={theme.value} value={theme.value}>
                  {theme.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
