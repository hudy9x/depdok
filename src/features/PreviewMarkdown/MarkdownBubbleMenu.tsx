import { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { FormatButtons } from "./MenuButtons";

interface MarkdownBubbleMenuProps {
  editor: Editor | null;
}

const BUBBLE_MENU_OPTIONS = {
  placement: 'top' as const,
  offset: 8,
};

export function MarkdownBubbleMenu({ editor }: MarkdownBubbleMenuProps) {
  if (!editor) return null;

  return (
    <BubbleMenu editor={editor} options={BUBBLE_MENU_OPTIONS}>
      <div className="flex items-center gap-1 p-1 bg-popover border border-border rounded-lg shadow-lg">
        <FormatButtons editor={editor} />
      </div>
    </BubbleMenu>
  );
}
