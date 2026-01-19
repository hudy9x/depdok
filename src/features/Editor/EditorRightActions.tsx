import { useState } from "react";
import { useAtom, useSetAtom } from "jotai";
import { Settings, Columns2, Code, Eye } from "lucide-react";
import { viewModeAtom } from "@/stores/EditorStore";
import { viewModeSettingAtom } from "@/stores/SettingsStore";
import { SettingsDialog } from "@/features/SettingsDialog";

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

        <Columns2 onClick={onSelectSidebySide} className={styleButtons + (isSidebySide ? 'opacity-100 bg-background/50' : '')} />
        <Code onClick={onSelectEditorOnly} className={styleButtons + (isEditorOnly ? 'opacity-100 bg-background/50' : '')} />
        <Eye onClick={onSelectPreviewOnly} className={styleButtons + (isPreviewOnly ? 'opacity-100 bg-background/50' : '')} />


      </div>

      <div>
        {/* Settings button */}

        <Settings onClick={() => setShowSettings(true)} className={styleButtons} />

      </div>


      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}
