import { useState } from "react";
import { Settings } from "lucide-react";
import { SettingsDialog } from "@/features/SettingsDialog";

export function EditorRightActions() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="flex items-center gap-3 h-[35px]">
      {/* Settings button */}
      <button
        title="Settings"
        onClick={() => setShowSettings(true)}
        className="flex items-center justify-center w-7 h-7 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
      >
        <Settings className="w-3.5 h-3.5" />
      </button>

      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}