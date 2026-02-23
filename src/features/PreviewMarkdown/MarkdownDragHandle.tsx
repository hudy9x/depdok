import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { Editor } from "@tiptap/react";
import { GripVertical } from "lucide-react";

interface MarkdownDragHandleProps {
  editor: Editor | null;
}

export function MarkdownDragHandle({ editor }: MarkdownDragHandleProps) {
  if (!editor) return null;

  return (
    <DragHandle
      editor={editor}
      computePositionConfig={{
        placement: "left-start",
        strategy: "fixed",
        middleware: [{ name: 'offset', fn: ({ x, y }) => ({ x, y: y + 2 }) }],
      }}
    >
      <div className="flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
        <GripVertical className="w-4 h-4" />
      </div>
    </DragHandle>
  );
}

