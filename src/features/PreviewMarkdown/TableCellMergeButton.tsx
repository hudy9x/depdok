import { Editor } from "@tiptap/react";
import { mergeCells } from "@tiptap/pm/tables";
import { AiOutlineMergeCells } from "react-icons/ai";

interface TableCellMergeButtonProps {
  editor: Editor;
}

export function TableCellMergeButton({ editor }: TableCellMergeButtonProps) {
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

  // const canMerge = isCellSelection && selectedCellCount > 1 && mergeCells(editor.state);

  return (
    <button
      type="button"
      title="Merge selected cells"
      // disabled={!canMerge}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={() => {
        mergeCells(editor.state, editor.view.dispatch);
        editor.view.focus();
      }}
      className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-muted-foreground hover:text-foreground"
    >
      <AiOutlineMergeCells className="!w-4 !h-4" />
    </button>
  );
}
