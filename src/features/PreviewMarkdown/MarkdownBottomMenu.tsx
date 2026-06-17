import { Editor } from "@tiptap/react";

import { BlockButtons } from "./MenuButtons";
import { MarkdownSizeControl, type MarkdownEditorSize } from "./MarkdownSizeControl";

interface MarkdownBottomMenuProps {
  editor: Editor | null;
  editable?: boolean;
  size: MarkdownEditorSize;
  onSizeChange: (size: MarkdownEditorSize) => void;
}

export function MarkdownBottomMenu({ editor, editable = false, size, onSizeChange }: MarkdownBottomMenuProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full border border-border bg-background/85 backdrop-blur-md px-2.5 py-1 shadow-lg max-w-[90vw] select-none">
      {editable && editor && (
        <>
          <div className="flex items-center gap-0.5">
            <BlockButtons editor={editor} />
          </div>
          <div className="w-[1px] h-5 bg-border mx-1" />
        </>
      )}
      <MarkdownSizeControl
        size={size}
        onSizeChange={onSizeChange}
        className="flex items-center gap-0.5"
      />
    </div>
  );
}
