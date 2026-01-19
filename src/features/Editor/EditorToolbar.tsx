import { useState } from "react";
import { Link } from "react-router-dom";
import { useAtomValue, useAtom, useSetAtom } from "jotai";
import { Settings, Columns2, Code, Eye, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { editorStateAtom, viewModeAtom } from "@/stores/EditorStore";
import { viewModeSettingAtom } from "@/stores/SettingsStore";
import { SettingsDialog } from "@/features/SettingsDialog";

export function EditorToolbar() {
  const editorState = useAtomValue(editorStateAtom);
  const [viewMode, setViewMode] = useAtom(viewModeAtom);
  const setViewModeSetting = useSetAtom(viewModeSettingAtom);
  const [showSettings, setShowSettings] = useState(false);

  const getFileName = (path: string | null) => {
    if (!path) return "Untitled";
    return path.split("/").pop() || "Untitled";
  };

  const handleViewModeChange = (mode: 'side-by-side' | 'editor-only' | 'preview-only') => {
    setViewMode(mode);
    setViewModeSetting(mode); // Persist to localStorage
  };

  return (
    <>
      <div className="fixed top-1 left-[100px] h-10 border-b flex items-center justify-between px-4 bg-background z-[99999]">
        {/* Left: Back button and file name with unsaved indicator */}
        <div className="flex items-center gap-2">
          <Link to="/">
            <Button
              variant="ghost"
              size="sm"
              title="Back to home"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <span className="text-sm font-medium">
            {getFileName(editorState.filePath)}
          </span>
          {editorState.isDirty && (
            <div
              className="w-2 h-2 rounded-full bg-orange-500"
              title="Unsaved changes"
            />
          )}
        </div>

        {/* Right: Settings button */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* View mode switcher - Fixed at top right */}
      <div className="fixed top-[40px] right-4 z-50 flex gap-1 border rounded-md p-1 bg-background shadow-lg">
        <Button
          variant={viewMode === 'side-by-side' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleViewModeChange('side-by-side')}
          title="Side-by-side"
        >
          <Columns2 className="w-4 h-4" />
        </Button>
        <Button
          variant={viewMode === 'editor-only' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleViewModeChange('editor-only')}
          title="Editor only"
        >
          <Code className="w-4 h-4" />
        </Button>
        <Button
          variant={viewMode === 'preview-only' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleViewModeChange('preview-only')}
          title="Preview only"
        >
          <Eye className="w-4 h-4" />
        </Button>
      </div>

      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </>
  );
}
