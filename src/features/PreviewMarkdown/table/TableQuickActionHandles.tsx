import React from "react";
import { Editor } from "@tiptap/react";
import { Plus, Trash2 } from "lucide-react";

interface TableQuickActionHandlesProps {
  isEditable: boolean;
  editor: Editor;
  onAddColumnRight: () => void;
  onAddRowBottom: () => void;
}

export function TableQuickActionHandles({
  isEditable,
  editor,
  onAddColumnRight,
  onAddRowBottom,
}: TableQuickActionHandlesProps): React.ReactElement | null {
  if (!isEditable) return null;

  return (
    <>
      {/* Right Add Column Handle */}
      <div
        className="absolute top-0 -right-4 bottom-0 w-3 bg-muted/50 rounded-r hover:bg-primary/20 cursor-pointer flex items-center justify-center opacity-0 group-hover/table:opacity-100 transition-opacity"
        onClick={onAddColumnRight}
        title="Add Column"
      >
        <Plus className="w-3 h-3 text-muted-foreground" />
      </div>

      {/* Bottom Add Row Handle */}
      <div
        className="absolute -bottom-4 left-0 right-0 h-3 bg-muted/50 rounded-b hover:bg-primary/20 cursor-pointer flex items-center justify-center opacity-0 group-hover/table:opacity-100 transition-opacity"
        onClick={onAddRowBottom}
        title="Add Row"
      >
        <Plus className="w-3 h-3 text-muted-foreground" />
      </div>

      {/* Top Right Delete Table Handle */}
      <div
        className="absolute -top-3 -right-3 w-6 h-6 bg-destructive/10 text-destructive rounded-md hover:bg-destructive hover:text-destructive-foreground cursor-pointer flex items-center justify-center opacity-0 group-hover/table:opacity-100 transition-opacity z-20"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onClick={() => (editor.chain().focus() as any).deleteTable().run()}
        title="Delete Table"
      >
        <Trash2 className="w-3 h-3" />
      </div>
    </>
  );
}
