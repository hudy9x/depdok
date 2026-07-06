import { useCallback, useState } from "react";
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const shouldShow = useCallback(({ editor }: { editor: Editor }) => {
    if (!editor.isEditable) return false;
    if (editor.state.selection.empty) return false;
    
    // Bubble menu stays visible if the editor is focused OR if the AI dropdown is active
    return editor.isFocused || isDropdownOpen;
  }, [isDropdownOpen]);

  if (!editor) return null;

  return (
    <BubbleMenu editor={editor} options={BUBBLE_MENU_OPTIONS} shouldShow={shouldShow}>
      <div className="flex items-center gap-1 p-1 bg-popover border border-border rounded-lg shadow-lg">
        <FormatButtons editor={editor} onDropdownOpenChange={setIsDropdownOpen} />
      </div>
    </BubbleMenu>
  );
}
