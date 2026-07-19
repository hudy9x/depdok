import { Editor } from "@tiptap/react";
import { splitCell } from "@tiptap/pm/tables";
import { AiOutlineSplitCells } from "react-icons/ai";

interface TableCellSplitButtonProps {
  editor: Editor;
  disabled?: boolean;
}

export function TableCellSplitButton({ editor, disabled }: TableCellSplitButtonProps) {
  return (
    <button
      type="button"
      title="Unmerge cell"
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={() => {
        splitCell(editor.state, editor.view.dispatch);
        editor.view.focus();
      }}
      className="p-2 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-muted-foreground hover:text-foreground flex items-center justify-center"
    >
      <AiOutlineSplitCells className="w-4 h-4" />
    </button>
  );
}
