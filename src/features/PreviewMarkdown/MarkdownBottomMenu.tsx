import { Editor } from "@tiptap/react";
import { BlockButtons } from "./MenuButtons";
import { MarkdownSizeControl, MarkdownSizeDropdown, type MarkdownEditorSize } from "./MarkdownSizeControl";
import { ExportButton } from "./ExportButton";

interface MarkdownBottomMenuProps {
  editor: Editor | null;
  editable?: boolean;
  size: MarkdownEditorSize;
  onSizeChange: (size: MarkdownEditorSize) => void;
  filePath?: string;
}

export function MarkdownBottomMenu({
  editor,
  editable = false,
  size,
  onSizeChange,
  filePath,
}: MarkdownBottomMenuProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full border border-border bg-background/85 backdrop-blur-md px-2.5 py-1 shadow-lg max-w-[95vw] select-none overflow-x-auto">
      {editable && editor && (
        <>
          <div className="flex items-center gap-0.5">
            <BlockButtons editor={editor} />
          </div>
          <div className="w-[1px] h-5 bg-border mx-1 shrink-0 editor-tools-divider" />
        </>
      )}
      <div className="size-control-expanded items-center gap-0.5 shrink-0">
        <MarkdownSizeControl
          size={size}
          onSizeChange={onSizeChange}
          className="flex items-center gap-0.5 shrink-0"
        />
      </div>
      <div className="size-control-dropdown items-center shrink-0">
        <MarkdownSizeDropdown
          size={size}
          onSizeChange={onSizeChange}
        />
      </div>
      {editor && (
        <div className="export-button-group items-center shrink-0">
          <div className="w-[1px] h-5 bg-border mx-1 shrink-0" />
          <ExportButton editor={editor} filePath={filePath} />
        </div>
      )}
    </div>
  );
}
