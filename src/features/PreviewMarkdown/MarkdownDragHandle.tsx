import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { Editor } from "@tiptap/react";
import { GripVertical, Plus } from "lucide-react";

interface MarkdownDragHandleProps {
  editor: Editor | null;
}

const DRAG_HANDLE_CONFIG = {
  placement: "left-start" as const,
  strategy: "fixed" as const,
  middleware: [{ name: 'offset' as const, fn: ({ x, y }: { x: number; y: number }) => ({ x: x - 6, y: y - -45 }) }],
};

export function MarkdownDragHandle({ editor }: MarkdownDragHandleProps) {
  if (!editor) return null;

  const handlePlusClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const { state } = editor;
    const { $from } = state.selection;
    const currentBlock = $from.parent;

    if (currentBlock && currentBlock.isTextblock && currentBlock.textContent.trim() === '') {
      editor.chain().focus().insertContent('/').run();
    } else {
      const endPos = $from.end();
      editor
        .chain()
        .focus()
        .setTextSelection(endPos)
        .insertContent('\n/')
        .run();
    }
  };

  return (
    <DragHandle
      editor={editor}
      computePositionConfig={DRAG_HANDLE_CONFIG}
    >
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={handlePlusClick}
          onMouseDown={(e) => e.stopPropagation()}
          className="flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
          title="Add block below (/)"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <div
          className="flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:text-foreground hover:bg-accent cursor-grab active:cursor-grabbing transition-colors"
          title="Drag to move"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      </div>
    </DragHandle>
  );
}

