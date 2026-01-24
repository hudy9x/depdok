import { useAtom } from "jotai";
import { editorThemeAtom } from "@/stores/SettingsStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import { THEME_MAPPING } from "@/lib/monaco-theme";

const AVAILABLE_THEMES = Object.entries(THEME_MAPPING).map(([key, value]) => ({
  value: key,
  label: value.label,
}));

export function MonacoThemeSetting() {
  const [editorTheme, setEditorTheme] = useAtom(editorThemeAtom);

  return (

    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label htmlFor="editor-theme">Editor Theme</Label>
        <p className="text-sm text-muted-foreground">
          Select a theme for the editor
        </p>
      </div>
      <Select value={editorTheme} onValueChange={setEditorTheme}>
        <SelectTrigger id="editor-theme" className="w-[200px]">
          <SelectValue placeholder="Select a theme" />
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
  );
}
