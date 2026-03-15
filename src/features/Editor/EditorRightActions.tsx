import { useState } from "react";
import { useAtom, useSetAtom } from "jotai";
import { Settings, Columns2, Code, Eye } from "lucide-react";
import { viewModeAtom } from "@/stores/EditorStore";
import { viewModeSettingAtom } from "@/stores/SettingsStore";
import { SettingsDialog } from "@/features/SettingsDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function EditorRightActions() {
  const [viewMode, setViewMode] = useAtom(viewModeAtom);
  const setViewModeSetting = useSetAtom(viewModeSettingAtom);
  const [showSettings, setShowSettings] = useState(false);

  const handleViewModeChange = (mode: 'side-by-side' | 'editor-only' | 'preview-only') => {
    setViewMode(mode);
    setViewModeSetting(mode); // Persist to localStorage
  };

  const isSidebySide = viewMode === 'side-by-side';
  const isEditorOnly = viewMode === 'editor-only';
  const isPreviewOnly = viewMode === 'preview-only';

  const onClickViewMode = (mode: 'side-by-side' | 'editor-only' | 'preview-only') => {
    handleViewModeChange(mode);
    setShowSettings(false);
  };

  const onSelectSidebySide = () => {
    onClickViewMode('side-by-side');
  };

  const onSelectEditorOnly = () => {
    onClickViewMode('editor-only');
  };

  const onSelectPreviewOnly = () => {
    onClickViewMode('preview-only');
  };

  const styleButtons = `w-8 h-[35px] p-2 cursor-pointer hover:opacity-90 opacity-50 `
  return (
    <div className="flex items-center gap-4 h-[35px]">
      <div className="flex items-center rounded-md divide-x divide-border">

        {/* View mode switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className={`${styleButtons} opacity-100 flex items-center justify-center`} title="Change View Mode">
              {isSidebySide && <Columns2 className="w-3 h-3" />}
              {isEditorOnly && <Code className="w-3 h-3" />}
              {isPreviewOnly && <Eye className="w-3 h-3" />}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={onSelectSidebySide}
              className={`gap-2 ${isSidebySide ? 'bg-accent pointer-events-none' : 'cursor-pointer'}`}
            >
              <Columns2 className="w-3 h-3" />
              <span className="text-xs">Side by Side</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onSelectEditorOnly}
              className={`gap-2 ${isEditorOnly ? 'bg-accent pointer-events-none' : 'cursor-pointer'}`}
            >
              <Code className="w-3 h-3" />
              <span className="text-xs">Editor Only</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onSelectPreviewOnly}
              className={`gap-2 ${isPreviewOnly ? 'bg-accent pointer-events-none' : 'cursor-pointer'}`}
            >
              <Eye className="w-3 h-3" />
              <span className="text-xs">Preview Only</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>


      </div>

      <div>
        {/* Settings button */}

        <Settings onClick={() => setShowSettings(true)} className={styleButtons} />

      </div>


      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}
