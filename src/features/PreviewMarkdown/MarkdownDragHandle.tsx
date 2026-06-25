import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { Editor } from "@tiptap/react";
import { GripVertical } from "lucide-react";

interface MarkdownDragHandleProps {
  editor: Editor | null;
}

const DRAG_HANDLE_CONFIG = {
  placement: "left-start" as const,
  strategy: "fixed" as const,
  middleware: [{ name: 'offset' as const, fn: ({ x, y }: { x: number; y: number }) => ({ x: x - 20, y: y + 2 }) }],
};

export function MarkdownDragHandle({ editor }: MarkdownDragHandleProps) {
  if (!editor) return null;

  return (
    <DragHandle
      editor={editor}
      computePositionConfig={DRAG_HANDLE_CONFIG}
    >
      <div className="flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
        <GripVertical className="w-4 h-4" />
      </div>
    </DragHandle>
  );
}

