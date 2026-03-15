import { useAtom, useSetAtom } from "jotai";
import { Columns2, Code, Eye } from "lucide-react";
import { viewModeAtom } from "@/stores/EditorStore";
import { viewModeSettingAtom } from "@/stores/SettingsStore";

// ─── New version: inline group button with muted background for active ──────

type ViewMode = "side-by-side" | "editor-only" | "preview-only";

const VIEW_MODES: { mode: ViewMode; icon: React.ReactNode; title: string }[] = [
  { mode: "editor-only", icon: <Code className="w-3.5 h-3.5" />, title: "Editor Only" },
  { mode: "side-by-side", icon: <Columns2 className="w-3.5 h-3.5" />, title: "Side by Side" },
  { mode: "preview-only", icon: <Eye className="w-3.5 h-3.5" />, title: "Preview Only" },
];

export function EditorViewMode() {
  const [viewMode, setViewMode] = useAtom(viewModeAtom);
  const setViewModeSetting = useSetAtom(viewModeSettingAtom);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setViewModeSetting(mode);
  };

  return (
    <div className="fixed bottom-2 left-3 z-50 flex items-center pt-1.5">
      <div className="flex items-center gap-3 h-[35px]">
        {/* Group button view-mode switcher */}
        <div className="flex items-center bg-muted rounded-md p-0.5 gap-0.5">
          {VIEW_MODES.map(({ mode, icon, title }) => {
            const isActive = viewMode === mode;
            return (
              <button
                key={mode}
                title={title}
                disabled={isActive}
                onClick={() => handleViewModeChange(mode)}
                className={[
                  "flex items-center justify-center w-7 h-6 rounded transition-colors",
                  isActive
                    ? "bg-background text-foreground shadow-sm cursor-default"
                    : "text-muted-foreground hover:text-foreground cursor-pointer",
                ].join(" ")}
              >
                {icon}
              </button>
            );
          })}
        </div>

      </div>
    </div>

  );
}
