import { useState } from "react";
import { useAtom } from "jotai";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CircleCheck, LoaderCircle } from "lucide-react";
import { plantUmlServerUrlAtom } from "@/stores/SettingsStore";

export function PlantUmlServerSetting() {
  const [plantUmlServerUrl, setPlantUmlServerUrl] = useAtom(plantUmlServerUrlAtom);
  const [isUpdating, setIsUpdating] = useState(false);
  const [urlError, setUrlError] = useState("");

  // Validate URL format
  const handleUrlChange = (value: string) => {
    setIsUpdating(true);

    // Allow empty string (means use default)
    if (value === "") {
      setPlantUmlServerUrl(value);
      setUrlError("");
      setTimeout(() => {
        setIsUpdating(false);
      }, 300);
      return;
    }

    // Basic URL validation
    try {
      new URL(value);
      setPlantUmlServerUrl(value);
      setUrlError("");
    } catch {
      setUrlError("Please enter a valid URL (e.g., https://example.com/plantuml)");
    }

    setTimeout(() => {
      setIsUpdating(false);
    }, 300);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="plantuml-server" className="flex items-center gap-2">
        PlantUML Server URL
        {isUpdating
          ? <LoaderCircle className="size-4 text-muted-foreground animate-spin" />
          : <CircleCheck className="size-4 text-green-300 dark:text-green-500" />}
      </Label>
      <p className="text-sm text-muted-foreground">
        Custom PlantUML server URL (leave empty to use default: https://img.plantuml.biz/plantuml)
      </p>
      <Input
        id="plantuml-server"
        type="text"
        placeholder="https://your-plantuml-server.com/plantuml"
        value={plantUmlServerUrl}
        onChange={(e) => handleUrlChange(e.target.value)}
        className={urlError ? "border-destructive" : ""}
      />
      {urlError && (
        <p className="text-sm text-destructive">{urlError}</p>
      )}
      <p className="text-xs text-muted-foreground italic">
        Note: Custom servers may not support dark mode theming
      </p>
    </div>
  );
}
