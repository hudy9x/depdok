import { Editor } from "@tiptap/react";
import { FloatingMenu } from "@tiptap/react/menus";
import { BlockButtons } from "./MenuButtons";

interface MarkdownFloatingMenuProps {
  editor: Editor | null;
}

export function MarkdownFloatingMenu({ editor }: MarkdownFloatingMenuProps) {
  if (!editor) return null;

  return (
    <FloatingMenu editor={editor}>
      <div className="flex items-center gap-1 p-1 bg-popover border border-border rounded-lg shadow-lg -translate-y-full">
        <BlockButtons editor={editor} />
      </div>
    </FloatingMenu>
  );
}
