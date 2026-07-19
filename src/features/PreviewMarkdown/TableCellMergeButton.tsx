import { Editor } from "@tiptap/react";
import { mergeCells } from "@tiptap/pm/tables";
import { AiOutlineMergeCells } from "react-icons/ai";

interface TableCellMergeButtonProps {
  editor: Editor;
  disabled?: boolean;
}

export function TableCellMergeButton({ editor, disabled }: TableCellMergeButtonProps) {
  const { selection } = editor.state;

  // Robust check for CellSelection (survives bundler class renaming/duplication)
  const isCellSelection = !!selection && (
    selection.constructor.name.includes("CellSelection") ||
    'forEachCell' in selection
  );

  // Count how many cells are in the selection — merge is possible when > 1
  let selectedCellCount = 0;
  if (isCellSelection) {
    (selection as any).forEachCell(() => {
      selectedCellCount++;
    });
  }

  const canMerge = !disabled && isCellSelection && selectedCellCount > 1;

  return (
    <button
      type="button"
      title="Merge selected cells"
      disabled={disabled || !canMerge}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={() => {
        mergeCells(editor.state, editor.view.dispatch);
        editor.view.focus();
      }}
      className="p-2 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-muted-foreground hover:text-foreground flex items-center justify-center"
    >
      <AiOutlineMergeCells className="w-4 h-4" />
    </button>
  );
}
