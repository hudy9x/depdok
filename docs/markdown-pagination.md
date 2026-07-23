# Markdown Pagination & Word-Like Page Layout Guide

This document explains the architecture, page calculation logic, CSS design system, and component integration for the Word-like Markdown Pagination extension in Depdok.

---

## Overview

The Word-Like Pagination extension transforms the continuous Tiptap Markdown editor into a paginated document view (A4 sheets with page breaks, page footers, and canvas gaps), emulating word processors like Microsoft Word or Google Docs — completely open-source without requiring paid Tiptap Pro packages.

The implementation is a **purely visual decoration layer**: the underlying ProseMirror document model remains continuous and clean without inserting intrusive structural "page" nodes into the document schema.

---

## Key Architecture & Features

### 1. Decoration-Based Pagination (`PaginationExtension`)
- Handled by a custom Tiptap extension wrapping a ProseMirror plugin (`src/features/PreviewMarkdown/extensions/pagination/PaginationExtension.ts`).
- On document edits or viewport updates, the plugin measures top-level block heights in the DOM and calculates overflow points based on standard page dimensions.
- Inserts `Decoration.widget` page-break spacers at position boundaries using `requestAnimationFrame` debouncing to avoid re-layout jitter.

### 2. Page Dimensions & Calculation Logic
- **Page Dimensions**: Standard A4 format at 96 DPI (794px width × 1123px height).
- **Usable Content Area**: 1123px height − 96px top margin − 96px bottom margin = 931px usable content height per page.
- **Left/Right Margins**: 72px (0.75 inch) padding inside each page card.
- **Page Gap**: 20px transparent/canvas-colored separation between page cards.

### 3. Page Break Spacer & Sibling Top Margin
Each inserted page-break spacer decoration consists of:
1. **`.page-break-bottom`**: Extends the current page card to the full height (remaining content space + 96px bottom margin) and renders a centered page number badge (e.g., `1`, `2`).
2. **`.page-break-gap`**: A 20px gap painted with the canvas backdrop color (`#e5e7eb` light / `#18181b` dark) with inset paper shadows (`inset 0 6px 6px -4px rgba(0, 0, 0, 0.15)`).
3. **Next Page Top Margin (`.page-break-spacer + *`)**: Rather than adding heavy wrapper elements, the 96px top margin of the next page is applied using the CSS adjacent sibling selector (`.page-break-spacer + *` / `[data-page-break="true"] + *`). This automatically applies `margin-top: 96px !important` to whichever block element follows the spacer.

### 4. Page Card Visual Design System
- **Square Sheets**: Clean, sharp square corners (`border-radius: 0 !important`) with no artificial borders (`border: none !important`).
- **Paper Drop Shadows**: Card paper elevation rendered via `box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.12)`.
- **Theme Support**:
  - **Light Mode**: White paper cards (`#ffffff`) over a gray canvas backdrop (`#e5e7eb`).
  - **Dark Mode**: Dark paper cards (`#242526`) over a dark canvas backdrop (`#18181b`).

---

## File Structure

```
src/
└── features/
    └── PreviewMarkdown/
        ├── extensions/
        │   └── pagination/
        │       ├── index.ts                 # Barrel export (Extension, plugin keys, options)
        │       ├── PaginationExtension.ts   # Core ProseMirror plugin & computePageBreaks logic
        │       └── PaginationExtension.css  # Page card, gap, and canvas backdrop styling
        ├── MarkdownSizeControl.tsx          # Size dropdown/toolbar ("small" | "wide" | "full" | "page")
        ├── MarkdownBottomMenu.tsx           # Toolbar holding size control and page layout mode toggle
        ├── MarkdownPreview.tsx              # Extension registration, isPageMode state, and toggle meta dispatch
        └── markdown.css                     # Global markdown prose styles
```

---

## Runtime Toggling & State Management

### 1. Editor Size Mode State
- Editor size is stored in `localStorage` under `markdown-editor-size` via `useLocalStorage`.
- Options: `"small" | "wide" | "full" | "page"`.
- When set to `"page"`, `isPageMode` becomes `true`.

### 2. Zero-Recreation Runtime Toggle
- The Tiptap editor instance is initialized once with `PaginationExtension` registered.
- Switching between `"wide"` / `"full"` / `"small"` and `"page"` mode does **not** recreate the editor.
- Switching modes dispatches a transaction meta to the ProseMirror plugin:
  ```ts
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(
      editor.state.tr.setMeta(PAGINATION_TOGGLE_META, isPageMode),
    );
  }, [editor, isPageMode]);
  ```
- The plugin toggles its internal `enabled` flag and clears or recomputes decorations cleanly.

---

## Related Documentation & Rules
- Implementation plan: [brain/91fc0ccf-d1cb-4eac-9d0f-d234b234e00b/implementation_plan.md](file:///Users/hudy/.gemini/antigravity-ide/brain/91fc0ccf-d1cb-4eac-9d0f-d234b234e00b/implementation_plan.md)
- Main guide in AGENTS.md: [AGENTS.md](file:///Users/hudy/ws/depdok/AGENTS.md)
