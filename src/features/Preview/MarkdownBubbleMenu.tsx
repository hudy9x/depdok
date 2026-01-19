import { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { FormatButtons } from "./MenuButtons";

interface MarkdownBubbleMenuProps {
  editor: Editor | null;
}

export function MarkdownBubbleMenu({ editor }: MarkdownBubbleMenuProps) {
  if (!editor) return null;

  return (
    <BubbleMenu editor={editor} options={{ placement: 'top', offset: 8 }}>
      <div className="flex items-center gap-1 p-1 bg-popover border border-border rounded-lg shadow-lg">
        <FormatButtons editor={editor} />
      </div>
    </BubbleMenu>
  );
}
