import { Editor } from "@tiptap/react";
import { splitCell } from "@tiptap/pm/tables";
import { AiOutlineSplitCells } from "react-icons/ai";

interface TableCellSplitButtonProps {
  editor: Editor;
}

export function TableCellSplitButton({ editor }: TableCellSplitButtonProps) {
  // const canSplit = splitCell(editor.state);

  return (
    <button
      type="button"
      title="Unmerge cell"
      // disabled={!canSplit}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={() => {
        splitCell(editor.state, editor.view.dispatch);
        editor.view.focus();
      }}
      className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-muted-foreground hover:text-foreground"
    >
      <AiOutlineSplitCells className="!w-4 !h-4" />
    </button>
  );
}
