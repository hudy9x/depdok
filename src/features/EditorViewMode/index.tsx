import { useAtom, useSetAtom, useAtomValue } from "jotai";
import { Columns2, Code, Eye } from "lucide-react";
import { useEffect, useMemo } from "react";
import { viewModeAtom, editorStateAtom } from "@/stores/EditorStore";
import { viewModeSettingAtom } from "@/stores/SettingsStore";

// ─── New version: inline group button with muted background for active ──────

type ViewMode = "side-by-side" | "editor-only" | "preview-only";

const VIEW_MODES: { mode: ViewMode; icon: React.ReactNode; title: string }[] = [
  { mode: "editor-only", icon: <Code className="w-3.5 h-3.5" />, title: "Editor Only" },
  { mode: "side-by-side", icon: <Columns2 className="w-3.5 h-3.5" />, title: "Side by Side" },
  { mode: "preview-only", icon: <Eye className="w-3.5 h-3.5" />, title: "Preview Only" },
];

const EXTENSION_SUPPORTED_MODES: Record<string, ViewMode[]> = {
  logger: ["side-by-side", "preview-only"],
  png: ["preview-only"],
  jpg: ["preview-only"],
  jpeg: ["preview-only"],
  gif: ["preview-only"],
  webp: ["preview-only"],
  svg: ["preview-only"],
  ico: ["preview-only"],
  bmp: ["preview-only"],
  excalidraw: ["preview-only"], // Excalidraw usually only needs preview
};

export function EditorViewMode() {
  const [viewMode, setViewMode] = useAtom(viewModeAtom);
  const setViewModeSetting = useSetAtom(viewModeSettingAtom);
  const editorState = useAtomValue(editorStateAtom);

  const ext = editorState.fileExtension?.toLowerCase() || "";

  const supportedModes = useMemo(() => {
    return EXTENSION_SUPPORTED_MODES[ext] || ["editor-only", "side-by-side", "preview-only"];
  }, [ext]);

  useEffect(() => {
    if (!supportedModes.includes(viewMode) && supportedModes.length > 0) {
      setViewMode(supportedModes[0]);
    }
  }, [viewMode, supportedModes, setViewMode]);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setViewModeSetting(mode);
  };

  const availableViewModes = VIEW_MODES.filter(m => supportedModes.includes(m.mode));

  if (availableViewModes.length <= 1) {
    return null; // hide switcher if there is only 1 or 0 options
  }

  return (
    <div className="fixed bottom-2 left-3 z-50 flex items-center pt-1.5">
      <div className="flex items-center gap-3 h-[35px]">
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
