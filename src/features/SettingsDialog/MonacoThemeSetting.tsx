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

const AVAILABLE_THEMES = [
  // Default VS Code themes
  { value: "vs", label: "Visual Studio Light" },
  { value: "vs-dark", label: "Visual Studio Dark" },
  // Custom themes
  { value: "Dracula", label: "Dracula" },
  { value: "Monokai", label: "Monokai" },
  { value: "Night Owl", label: "Night Owl" },
  { value: "Solarized-dark", label: "Solarized Dark" },
  { value: "Solarized-light", label: "Solarized Light" },
  { value: "Tomorrow-Night", label: "Tomorrow Night" },
  { value: "Cobalt2", label: "Cobalt2" },
  { value: "GitHub Dark", label: "GitHub Dark" },
  { value: "GitHub Light", label: "GitHub Light" },
  { value: "Nord", label: "Nord" },
];

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
