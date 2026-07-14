import { useSetAtom } from "jotai";
import { Columns2, Code, Eye } from "lucide-react";
import { useEffect, useMemo } from "react";
import { updatePaneViewModeAtom, type ViewMode } from "@/stores/PaneStore";
import { viewModeSettingAtom } from "@/stores/SettingsStore";
import { isKnowledgeGraphFile } from "@/lib/knowledgeGraph";

const VIEW_MODES: { mode: ViewMode; icon: React.ReactNode; title: string }[] = [
  { mode: "editor-only", icon: <Code className="w-3.5 h-3.5" />, title: "Editor Only" },
  { mode: "side-by-side", icon: <Columns2 className="w-3.5 h-3.5" />, title: "Side by Side" },
  { mode: "preview-only", icon: <Eye className="w-3.5 h-3.5" />, title: "Preview Only" },
];

const EXTENSION_SUPPORTED_MODES: Record<string, ViewMode[]> = {
  png: ["preview-only"],
  jpg: ["preview-only"],
  jpeg: ["preview-only"],
  gif: ["preview-only"],
  webp: ["preview-only"],
  svg: ["preview-only"],
  ico: ["preview-only"],
  bmp: ["preview-only"],
  excalidraw: ["preview-only"],
};

interface EditorViewModeProps {
  paneId: string;
  filePath: string;
  viewMode: ViewMode;
}

export function EditorViewMode({ paneId, filePath, viewMode }: EditorViewModeProps) {
  const setPaneViewMode = useSetAtom(updatePaneViewModeAtom);
  const setViewModeSetting = useSetAtom(viewModeSettingAtom);

  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const isGraphFile = isKnowledgeGraphFile(filePath);

  const supportedModes = useMemo(() => {
    if (isGraphFile) {
      return ["preview-only"] as ViewMode[];
    }

    return EXTENSION_SUPPORTED_MODES[ext] || ["editor-only", "side-by-side", "preview-only"];
  }, [ext, isGraphFile]);

  useEffect(() => {
    if (!supportedModes.includes(viewMode) && supportedModes.length > 0) {
      setPaneViewMode({ paneId, viewMode: supportedModes[0] });
    }
  }, [viewMode, supportedModes, paneId, setPaneViewMode]);

  const handleViewModeChange = (mode: ViewMode) => {
    setPaneViewMode({ paneId, viewMode: mode });
    setViewModeSetting(mode);
  };

  const availableViewModes = VIEW_MODES.filter(m => supportedModes.includes(m.mode));

  if (availableViewModes.length <= 1) {
    return null; // hide switcher if there is only 1 or 0 options
  }

  return (
    <div className="">
      <div className="flex items-center gap-3">
        {/* Group button view-mode switcher */}
        <div className="flex items-center bg-muted rounded-md p-0.5 gap-0.5">
          {availableViewModes.map(({ mode, icon, title }) => {
            const isActive = viewMode === mode;
            return (
              <button
                key={mode}
                title={title}
                disabled={isActive}
                onClick={() => handleViewModeChange(mode)}
                className={[
                  "flex items-center justify-center w-7 h-5 rounded transition-colors",
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
