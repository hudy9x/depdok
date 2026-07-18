/**
 * CustomTableCell — extends TipTap's TableCell to add a `backgroundColor`
 * attribute that persists as an inline `style` on the <td> element.
 *
 * This allows the HTML table serializer to round-trip background colours
 * when saving/loading Markdown files.
 *
 * CustomTableHeader additionally adds a `colwidth` attribute that persists
 * the user-dragged column width as `style="width:Xpx"` on the <th> element.
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

/**
 * Reads the pixel width from `style="width:Xpx"` on a <th> element.
 * Returns null when no explicit width is set.
 */
const colWidthAttr = {
  colwidth: {
    default: null as number | null,
    parseHTML: (element: HTMLElement) => {
      const w = element.style.width;
      if (!w) return null;
      const px = parseFloat(w);
      return Number.isFinite(px) && px > 0 ? px : null;
    },
    renderHTML: (attrs: Record<string, unknown>) => {
      if (!attrs.colwidth) return {};
      return { style: `width:${attrs.colwidth}px; min-width:${attrs.colwidth}px;` };
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
      ...colWidthAttr,
    };
  },
});
