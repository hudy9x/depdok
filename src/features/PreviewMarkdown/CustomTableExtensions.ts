/**
 * CustomTableCell — extends TipTap's TableCell to add a `backgroundColor`
 * attribute that persists as an inline `style` on the <td> element.
 *
 * This allows the HTML table serializer to round-trip background colours
 * when saving/loading Markdown files.
 */
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";

const backgroundColorAttr = {
  backgroundColor: {
    default: null as string | null,
    parseHTML: (element: HTMLElement) => {
      const classes = element.getAttribute("class") || "";
      const match = classes.match(/\bbg-table-[a-z]+\b/);
      return match ? match[0] : null;
    },
    renderHTML: (attrs: Record<string, unknown>) => {
      if (!attrs.backgroundColor) return {};
      return { class: attrs.backgroundColor };
    },
  },
};

export const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...backgroundColorAttr,
    };
  },
});

export const CustomTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...backgroundColorAttr,
    };
  },
});
