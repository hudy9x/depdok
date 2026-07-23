import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, EditorView } from "@tiptap/pm/view";

/** A4 at 96 DPI ≈ 794 × 1123 px */
const DEFAULT_PAGE_WIDTH = 794;
const DEFAULT_PAGE_HEIGHT = 1123;
const DEFAULT_MARGIN_TOP = 96;
const DEFAULT_MARGIN_BOTTOM = 96;
const DEFAULT_PAGE_GAP = 20;

export interface PaginationOptions {
  /** Total page width in px (default 794 — A4 at 96 DPI) */
  pageWidth: number;
  /** Total page height in px (default 1123 — A4 at 96 DPI) */
  pageHeight: number;
  /** Top margin inside each page in px */
  marginTop: number;
  /** Bottom margin inside each page in px */
  marginBottom: number;
  /** Gap between pages in px (margin-bottom between pages, default 20px) */
  pageGap: number;
  /** Whether pagination is active */
  enabled: boolean;
}

/** Exported so that consumers can dispatch `setMeta(PAGINATION_PLUGIN_KEY, { enabled: true/false })` */
export const PAGINATION_PLUGIN_KEY = new PluginKey("pagination");

/** Meta key to toggle the enabled state at runtime */
const TOGGLE_META = "pagination-toggle";

/**
 * Build the DOM element that visually separates two pages.
 * Occupies the remaining space on the current page + bottom margin + 20px gap.
 * The top margin of the next page is applied directly to the nearby sibling element (.page-break-spacer + *).
 */
function createPageBreakSpacer(
  remainingSpace: number,
  pageGap: number,
  pageNumber: number,
  marginBottom: number,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "page-break-spacer";
  wrapper.contentEditable = "false";
  wrapper.setAttribute("data-page-break", "true");

  // Bottom area of current page (remaining content space + bottom margin)
  const bottomArea = document.createElement("div");
  bottomArea.className = "page-break-bottom";
  bottomArea.style.height = `${remainingSpace + marginBottom}px`;

  const footer = document.createElement("div");
  footer.className = "page-break-footer";
  footer.innerHTML = `<span class="page-footer-page-num">${pageNumber}</span>`;
  bottomArea.appendChild(footer);
  wrapper.appendChild(bottomArea);

  // 20px gap between pages (margin-bottom between pages)
  const gap = document.createElement("div");
  gap.className = "page-break-gap";
  gap.style.height = `${pageGap}px`;
  wrapper.appendChild(gap);

  return wrapper;
}

/**
 * Walk the editor DOM and compute where page breaks should be inserted.
 * Returns an array of { pos, remainingSpace, pageNumber } objects.
 */
function computePageBreaks(
  view: EditorView,
  opts: PaginationOptions,
): { pos: number; remainingSpace: number; pageNumber: number }[] {
  const { pageHeight, marginTop, marginBottom } = opts;
  const usableHeight = pageHeight - marginTop - marginBottom;

  const dom = view.dom;
  const children = dom.children;
  if (!children.length) return [];

  const breaks: { pos: number; remainingSpace: number; pageNumber: number }[] = [];

  let cumulativeHeight = 0;
  let currentPage = 1;

  for (let i = 0; i < children.length; i++) {
    const child = children[i] as HTMLElement;

    // Skip page break spacers from previous render
    if (child.dataset?.pageBreak === "true" || child.classList.contains("page-break-spacer")) {
      continue;
    }

    const rect = child.getBoundingClientRect();
    const blockHeight = rect.height;

    // Get the margin between blocks (computed style)
    const style = window.getComputedStyle(child);
    const blockMarginTop = parseFloat(style.marginTop) || 0;
    const blockMarginBottom = parseFloat(style.marginBottom) || 0;
    const totalBlockHeight = blockHeight + blockMarginTop + blockMarginBottom;

    if (cumulativeHeight + totalBlockHeight > usableHeight && cumulativeHeight > 0) {
      // This block overflows the current page
      const remainingSpace = usableHeight - cumulativeHeight;

      // Get the ProseMirror position for this block.
      let pos: number;
      try {
        pos = view.posAtDOM(child, 0);
        const resolved = view.state.doc.resolve(pos);
        if (resolved.depth > 0) {
          pos = resolved.before(resolved.depth);
        }
      } catch {
        continue;
      }

      breaks.push({ pos, remainingSpace: Math.max(remainingSpace, 0), pageNumber: currentPage });
      currentPage++;
      cumulativeHeight = totalBlockHeight;
    } else {
      cumulativeHeight += totalBlockHeight;
    }
  }

  return breaks;
}

/**
 * Create the ProseMirror plugin that manages page break decorations.
 */
function createPaginationPlugin(initialOptions: PaginationOptions): Plugin {
  let rafHandle: number | null = null;
  let currentEnabled = initialOptions.enabled;
  const opts = { ...initialOptions };

  return new Plugin({
    key: PAGINATION_PLUGIN_KEY,

    state: {
      init(): DecorationSet {
        return DecorationSet.empty;
      },
      apply(tr, oldSet): DecorationSet {
        const toggleMeta = tr.getMeta(TOGGLE_META);
        if (toggleMeta !== undefined) {
          currentEnabled = Boolean(toggleMeta);
        }

        const decoMeta = tr.getMeta(PAGINATION_PLUGIN_KEY);
        if (decoMeta !== undefined) {
          return decoMeta as DecorationSet;
        }
        if (tr.docChanged) {
          return oldSet.map(tr.mapping, tr.doc);
        }
        return oldSet;
      },
    },

    view(editorView) {
      const recompute = () => {
        if (rafHandle !== null) cancelAnimationFrame(rafHandle);
        rafHandle = requestAnimationFrame(() => {
          rafHandle = null;

          if (!currentEnabled) {
            const currentSet = PAGINATION_PLUGIN_KEY.getState(editorView.state) as DecorationSet;
            if (currentSet && currentSet !== DecorationSet.empty) {
              editorView.dispatch(
                editorView.state.tr.setMeta(PAGINATION_PLUGIN_KEY, DecorationSet.empty),
              );
            }
            return;
          }

          const pageBreaks = computePageBreaks(editorView, opts);

          const decorations = pageBreaks.map(({ pos, remainingSpace, pageNumber }) =>
            Decoration.widget(
              pos,
              createPageBreakSpacer(
                remainingSpace,
                opts.pageGap,
                pageNumber,
                opts.marginBottom,
              ),
              {
                side: -1,
                key: `page-break-${pageNumber}`,
              },
            ),
          );

          const newSet = DecorationSet.create(editorView.state.doc, decorations);
          editorView.dispatch(editorView.state.tr.setMeta(PAGINATION_PLUGIN_KEY, newSet));
        });
      };

      setTimeout(recompute, 100);

      return {
        update(_view, _prevState) {
          recompute();
        },
        destroy() {
          if (rafHandle !== null) cancelAnimationFrame(rafHandle);
        },
      };
    },

    props: {
      decorations(state): DecorationSet {
        return PAGINATION_PLUGIN_KEY.getState(state) as DecorationSet;
      },
    },
  });
}

/**
 * Tiptap Pagination Extension.
 */
export const PaginationExtension = Extension.create<PaginationOptions>({
  name: "pagination",

  addOptions() {
    return {
      pageWidth: DEFAULT_PAGE_WIDTH,
      pageHeight: DEFAULT_PAGE_HEIGHT,
      marginTop: DEFAULT_MARGIN_TOP,
      marginBottom: DEFAULT_MARGIN_BOTTOM,
      pageGap: DEFAULT_PAGE_GAP,
      enabled: false,
    };
  },

  addProseMirrorPlugins() {
    return [createPaginationPlugin(this.options)];
  },
});

export { TOGGLE_META as PAGINATION_TOGGLE_META };
