# Markdown Comments & Tiptap Extension Guide

This document explains the architecture, storage format, state management, and UI implementation for the Markdown Comment extension in Depdok.

---

## Overview

The Markdown Comment system allows users to highlight text selection in the Markdown editor, attach comment threads with replies, mark comments as resolved, and store all comment data cleanly inside the Markdown file itself without breaking standard Markdown compatibility.

---

## Storage Format & Serialization

Comment data is stored inside the Markdown file in a dual structure:

### 1. Inline Anchor Marks (`<span>`)
The text selection is wrapped in an inline HTML tag with a `data-comment-id` attribute:
```markdown
Here is some <span data-comment-id="1721580000000-abc1234">commented text</span> in the document.
```
- Handled by `CommentMark` (`src/features/PreviewMarkdown/extensions/CommentMark.ts`).
- Standard Markdown readers (VS Code, GitHub, Obsidian) preserve or render the text normally.
- In Depdok, `CommentMark` renders the text with a dashed underline.

### 2. Comment Thread Data (`<!-- HTML Comments -->`)
All rich comment metadata (author, timestamp, text, replies, resolved state) is appended to the **very end** of the `.md` file as HTML comment blocks:
```markdown
<!-- DEPDOK_COMMENT_1721580000000-abc1234: {"id":"1721580000000-abc1234","text":"Great point!","author":"Me","createdAt":"2026-07-21T16:00:00.000Z","resolved":false,"replies":[{"id":"1721580100000-def5678","text":"Thanks!","author":"Me","createdAt":"2026-07-21T16:01:00.000Z"}]} -->
```
- **Invisible in other apps**: HTML comments are ignored by Markdown renderers.
- **Parsing**: `extractComments(markdown)` strips these blocks on load and populates the Jotai comment store.
- **Serialization**: `appendComments(markdown, threads)` appends active and resolved comment threads when saving.

---

## Core Modules & File Structure

```
src/
└── features/
    └── PreviewMarkdown/
        ├── extensions/
        │   └── comment/
        │       ├── index.ts                   # Barrel export for all comment extension modules
        │       ├── CommentMark.ts             # Custom Tiptap mark with renderMarkdown support
        │       ├── commentStore.ts            # Jotai state store & action atoms
        │       ├── commentParser.ts           # Extract and serialize HTML comment blocks
        │       ├── useCommentExtension.ts     # Custom hook encapsulating parsing, syncing, DOM listeners & save logic
        │       ├── useCommentAuthor.ts        # Hook & helpers for persistent author username (localStorage)
        │       ├── CommentSidebar.tsx         # Comment drawer with Open / Resolved tab filter
        │       ├── CommentThread.tsx          # Clean thread card (no avatar, inline author input, replies)
        │       └── MarkdownCommentSidebar.tsx# Sidebar wrapper component with visibility check
        ├── MarkdownBottomMenu.tsx             # Bottom menu toolbar containing Add Comment popover & sidebar toggle
        ├── MarkdownPreview.tsx                # Clean Markdown editor integration
        └── markdown.css                       # Styling for .comment-mark and .comment-sidebar-panel
```

---

## State Management (`src/features/PreviewMarkdown/extensions/comment/commentStore.ts`)

Global comment state is managed using **Jotai** atoms:

- `commentThreadsAtom`: Array of `CommentThread` objects.
- `activeCommentIdAtom`: `string | null` ID of the currently focused comment.
- `commentSidebarVisibleAtom`: `boolean` flag to toggle the right-hand comment drawer.

---

## Component Details & Flow

### 1. Adding & Managing Comments
1. User selects text in the editor.
2. User clicks the **Add Comment** (`MessageSquarePlus`) button in the bottom menu (`MarkdownBottomMenu.tsx`).
3. A popover opens with an **inline username field** (`Posting as: [ Name ]`) pre-filled from `localStorage` (`depdok-comment-username`).
4. On submission:
   - `editor.chain().focus().setCommentMark(id).run()` applies `<span data-comment-id="...">`.
   - `addThread` dispatches the new `CommentThread` with the saved author name to Jotai.
   - The sidebar does **not** auto-open (opens only when user clicks the sidebar toggle button).
   - Document is marked as dirty (`markFileAsDirty`) so changes can be saved.

### 2. Open / Resolved Filter Switcher & Open-Only Badge Counter
- **Sidebar Tab Filter**: The `CommentSidebar` header features an `[ Open (X) | Resolved (Y) ]` tab switcher, defaulting to **Open**.
- **Open-Only Badge**: The bottom toolbar toggle button (`MessageSquare`) and sidebar header badge count **Open (unresolved) comments only** (`openCommentCount = threads.filter(t => !t.resolved).length`). If `openCommentCount === 0`, the badge is hidden.
- **Resolving Comments**: When a comment is marked as resolved, `unsetCommentMark(id)` removes the `<span data-comment-id="...">` inline mark and dashed underline from the document text, returning the text to plain text (`<span data-comment-id="123">an answer grounde</span>` → `an answer grounde`). On file load, `extractComments` automatically unwraps resolved comment spans to plain text.

### 3. Persistent Author Username (`useCommentAuthor`)
- Reading and writing the username is abstracted via `useCommentAuthor()` hook and saved to `localStorage` (`depdok-comment-username`).
- Shown as a small, clean inline input in both the **Add Comment** popover (`Posting as: ...`) and the **Reply** box (`Replying as: ...`). Editing either instantly persists the new display name.

### 4. Dirty State Tracking
- Adding replies, editing comments, resolving threads, or deleting comment threads automatically marks the file as dirty (`markFileAsDirty`) and triggers auto-save/draft save via `useCommentExtension`.

### 5. Bidirectional Highlighting & Scrolling
- **Editor → Sidebar**: Clicking a `<span data-comment-id>` in the editor sets `activeCommentIdAtom`, highlighting the matching `CommentThreadCard` with `border-primary`.
- **Sidebar → Editor**: Clicking a card in `CommentSidebar` sets `activeCommentIdAtom` and calls `scrollIntoView({ behavior: 'smooth', block: 'center' })` on the matching DOM element in the editor.

### 6. Drawer Item Styling
- Selected comment card uses `border-primary bg-card` (border highlighted using primary theme color). Circle avatars are removed for a clean, text-focused UI.

---

## Related Rules & Reference Links
- Plan document: [docs/plan/markdown-comment-extension.md](file:///Users/hudy/ws/depdok/docs/plan/markdown-comment-extension.md)
- Main guide in AGENTS.md: [AGENTS.md](file:///Users/hudy/ws/depdok/AGENTS.md)
