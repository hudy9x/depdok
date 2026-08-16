import { useTodoDocument } from "./useTodoDocument";
import { WeekView } from "./Week/WeekView";
import { KanbanView } from "./Kanban/KanbanView";
import { ViewModeSwitcher } from "./ViewModeSwitcher";
import { EditorViewMode } from "@/features/EditorViewMode";

interface TodoPreviewProps {
  content: string;
  onContentChange?: (content: string) => void;
  editable?: boolean;
  filePath?: string;
}

export function TodoPreview({ content, onContentChange, editable = false, filePath }: TodoPreviewProps) {
  const {
    document,
    handleModeChange,
    ...handlers
  } = useTodoDocument({ content, editable, onContentChange, filePath });

  const currentMode = document.config?.mode || "kanban";

  return (
    <div className="relative w-full h-full">
      {currentMode === "week" ? (
        <WeekView
          document={document}
          editable={editable}
          onToggleItem={handlers.handleToggleItem}
          onUpdateItemTitle={handlers.handleUpdateItemTitle}
          onUpdateItemMetadata={handlers.handleUpdateItemMetadata}
          onRemoveItem={handlers.handleRemoveItem}
          onAddItem={handlers.handleAddItem}
        />
      ) : (
        <KanbanView document={document} editable={editable} handlers={handlers} />
      )}

      <div className="absolute bottom-6 right-6 z-30 flex items-center gap-2">
        <EditorViewMode />
        <ViewModeSwitcher
          mode={currentMode}
          onModeChange={handleModeChange}
          editable={editable}
        />
      </div>
    </div>
  );
}
