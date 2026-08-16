import * as React from "react";
import { useSetAtom } from "jotai";
import { Columns2, Code, Eye } from "lucide-react";
import { useEffect, useMemo } from "react";
import { updatePaneViewModeAtom, type ViewMode } from "@/stores/PaneStore";
import { viewModeSettingAtom } from "@/stores/SettingsStore";
import { isKnowledgeGraphFile } from "@/lib/knowledgeGraph";
import { usePaneContext } from "@/features/EditorWorkspace/PaneContext";
import { cn } from "@/lib/utils";

const VIEW_MODES: { mode: ViewMode; icon: React.ReactNode; title: string }[] = [
  { mode: "editor-only", icon: <Code className="w-3.5 h-3.5" />, title: "Editor Only" },
  { mode: "side-by-side", icon: <Columns2 className="w-3.5 h-3.5" />, title: "Side by Side" },
  { mode: "preview-only", icon: <Eye className="w-3.5 h-3.5" />, title: "Preview Only" },
];

const EXTENSION_SUPPORTED_MODES: Record<string, ViewMode[]> = {
  md: ["editor-only", "preview-only"],
  todo: ["editor-only", "preview-only"],
  mmd: ["editor-only", "preview-only"],
  puml: ["editor-only", "preview-only"],
  pu: ["editor-only", "preview-only"],
  npuml: ["editor-only", "preview-only"],
  nplantuml: ["editor-only", "preview-only"],
  excalidraw: ["editor-only", "preview-only"],
  png: ["preview-only"],
  jpg: ["preview-only"],
  jpeg: ["preview-only"],
  gif: ["preview-only"],
  webp: ["preview-only"],
  svg: ["preview-only"],
  ico: ["preview-only"],
  bmp: ["preview-only"],
};

export interface EditorViewModeProps {
  paneId?: string;
  filePath?: string;
  viewMode?: ViewMode;
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export function EditorViewMode(props: EditorViewModeProps) {
  const context = usePaneContext();
  const paneId = props.paneId ?? context?.paneId ?? "";
  const filePath = props.filePath ?? context?.filePath ?? "";
  const viewMode = props.viewMode ?? context?.viewMode ?? "preview-only";
  const orientation = props.orientation ?? "horizontal";

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
    if (!supportedModes.includes(viewMode) && supportedModes.length > 0 && paneId) {
      setPaneViewMode({ paneId, viewMode: supportedModes[0] });
    }
  }, [viewMode, supportedModes, paneId, setPaneViewMode]);

  const handleViewModeChange = (mode: ViewMode) => {
    if (paneId) {
      setPaneViewMode({ paneId, viewMode: mode });
    }
    setViewModeSetting(mode);
  };

  const availableViewModes = VIEW_MODES.filter((m) => supportedModes.includes(m.mode));

  if (availableViewModes.length <= 1) {
    return null; // hide switcher if there is only 1 or 0 options
  }

  const isVertical = orientation === "vertical";

  return (
    <div
      className={cn(
        "flex items-center bg-background/95 border border-border/80 shadow-md rounded-lg p-1 select-none",
        isVertical ? "flex-col gap-1" : "flex-row gap-0.5",
        props.className
      )}
    >
      {availableViewModes.map(({ mode, icon, title }) => {
        const isActive = viewMode === mode;
        return (
          <button
            key={mode}
            type="button"
            title={title}
            disabled={isActive}
            onClick={() => handleViewModeChange(mode)}
            className={cn(
              "flex items-center justify-center rounded-md transition-colors",
              isVertical ? "w-6 h-6" : "w-6 h-6",
              isActive
                ? "bg-accent text-accent-foreground shadow-xs font-semibold cursor-default"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer"
            )}
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
}
