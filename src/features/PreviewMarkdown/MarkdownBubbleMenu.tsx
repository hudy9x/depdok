import { useCallback, useState } from "react";
import { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { FormatButtons } from "./MenuButtons";
import { TableCellColorPicker } from "./TableCellColorPicker";
import { TableCellMergeButton } from "./TableCellMergeButton";
import { TableCellSplitButton } from "./TableCellSplitButton";

const BUBBLE_MENU_OPTIONS = {
  placement: 'top' as const,
  offset: 8,
};

interface MarkdownBubbleMenuProps {
  editor: Editor | null;
}

export function MarkdownBubbleMenu({ editor }: MarkdownBubbleMenuProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const shouldShow = useCallback(({ editor: e }: { editor: Editor }) => {
    if (!e.isEditable) return false;
    if (!e.isFocused && !isDropdownOpen) return false;

    const { selection: sel } = e.state;

    // Show on:
    // 1. Text selection (non-empty)
    // 2. Cell selection (multi-cell)
    // 3. Cursor inside a table cell/header
    const hasTextSelection = !sel.empty;
    const isCellSel = !!sel && (
      sel.constructor.name.includes("CellSelection") ||
      'forEachCell' in sel
    );

    let inCellNode = false;
    if (sel && sel.$from) {
      for (let depth = sel.$from.depth; depth > 0; depth--) {
        const name = sel.$from.node(depth)?.type?.name;
        if (name === 'tableCell' || name === 'tableHeader') {
          inCellNode = true;
          break;
        }
      }
    }

    return hasTextSelection || isCellSel || inCellNode;
  }, [isDropdownOpen]);

  if (!editor) return null;



  // Merge bubble menu options with custom positioning if table cells are selected
  const bubbleMenuOptions = {
    ...BUBBLE_MENU_OPTIONS,
    getReferenceClientRect: () => {
      const view = editor.view;
      const cells = view.dom.querySelectorAll('.selectedCell');

      // If there are multiple cells selected visually, position relative to their combined bounds
      if (cells.length > 0) {
        let minTop = Infinity, minLeft = Infinity, maxBottom = -Infinity, maxRight = -Infinity;
        cells.forEach(cell => {
          const rect = cell.getBoundingClientRect();
          if (rect.top < minTop) minTop = rect.top;
          if (rect.left < minLeft) minLeft = rect.left;
          if (rect.bottom > maxBottom) maxBottom = rect.bottom;
          if (rect.right > maxRight) maxRight = rect.right;
        });
        return {
          width: maxRight - minLeft,
          height: maxBottom - minTop,
          top: minTop,
          bottom: maxBottom,
          left: minLeft,
          right: maxRight,
          x: minLeft,
          y: minTop,
          toJSON() { return this; }
        };
      }

      // Default positioning fallback to TipTap's text selection bounding box
      const { selection: sel } = view.state;
      const range = { from: sel.from, to: sel.to };
      try {
        const fromCoords = view.coordsAtPos(range.from);
        const toCoords = view.coordsAtPos(range.to);
        const top = Math.min(fromCoords.top, toCoords.top);
        const bottom = Math.max(fromCoords.bottom, toCoords.bottom);
        const left = Math.min(fromCoords.left, toCoords.left);
        const right = Math.max(fromCoords.right, toCoords.right);

        return {
          width: right - left,
          height: bottom - top,
          top,
          bottom,
          left,
          right,
          x: left,
          y: top,
          toJSON() { return this; }
        };
      } catch {
        return view.dom.getBoundingClientRect();
      }
    }
  };

  return (
    <BubbleMenu editor={editor} options={bubbleMenuOptions} shouldShow={shouldShow}>
      <div className="flex items-center gap-1 p-1 bg-popover border border-border rounded-lg shadow-lg">
        {/* Normal Text formatting buttons */}
        <FormatButtons editor={editor} onDropdownOpenChange={setIsDropdownOpen} />

        <div className="w-[1px] h-4 bg-border mx-1" />
        <TableCellColorPicker editor={editor} />
        <TableCellMergeButton editor={editor} />
        <TableCellSplitButton editor={editor} />
      </div>
    </BubbleMenu>
  );
}
