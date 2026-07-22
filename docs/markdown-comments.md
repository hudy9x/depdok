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
├── stores/
│   └── commentStore.ts             # Jotai state store & action atoms
├── lib/
│   └── commentParser.ts            # Extract and serialize comment blocks
└── features/
    └── PreviewMarkdown/
        ├── extensions/
        │   └── CommentMark.ts      # Custom Tiptap mark with renderMarkdown support
        ├── components/
        │   ├── CommentSidebar.tsx  # Comment drawer / sidebar panel
        │   └── CommentThread.tsx   # Thread card (edit, reply, resolve, delete)
        ├── MarkdownBottomMenu.tsx  # Bottom menu toolbar containing Add Comment popover & sidebar toggle
        ├── MarkdownPreview.tsx     # Markdown editor integration & bidirectional scroll handlers
        └── markdown.css            # Styling for .comment-mark and .comment-sidebar-panel
```

---

## State Management (`src/stores/commentStore.ts`)

Global comment state is managed using **Jotai** atoms:

- `commentThreadsAtom`: Array of `CommentThread` objects.
- `activeCommentIdAtom`: `string | null` ID of the currently focused comment.
- `commentSidebarVisibleAtom`: `boolean` flag to toggle the right-hand comment drawer.

### Action Atoms
- `addCommentThreadAtom`: Appends a new thread and sets it active.
- `updateCommentTextAtom`: Edits a thread's main text.
- `addCommentReplyAtom`: Adds a reply object to a thread.
- `toggleCommentResolvedAtom`: Toggles the resolved status.
- `deleteCommentThreadAtom`: Removes a thread and clears `activeCommentId` if active.
- `deleteCommentReplyAtom`: Removes a specific reply from a thread.

---

## Component Details & Flow

### 1. Adding a Comment
1. User selects text in the editor.
2. User clicks the **Add Comment** (`MessageSquarePlus`) button in the bottom menu (`MarkdownBottomMenu.tsx`).
3. A popover opens to enter comment text.
4. On submission:
   - `editor.chain().focus().setCommentMark(id).run()` applies `<span data-comment-id="...">`.
   - `addThread` dispatches the new `CommentThread` to Jotai.
   - Comment sidebar opens automatically.

### 2. Bidirectional Highlighting & Scrolling
- **Editor → Sidebar**: Clicking a `<span data-comment-id>` in the editor sets `activeCommentIdAtom`, highlighting the matching `CommentThreadCard` with `border-primary`.
- **Sidebar → Editor**: Clicking a card in `CommentSidebar` sets `activeCommentIdAtom` and calls `scrollIntoView({ behavior: 'smooth', block: 'center' })` on the matching DOM element in the editor.

### 3. Drawer Item Styling
- Selected comment card uses `border-primary bg-card` (border highlighted using primary theme color).

---

## Related Rules & Reference Links
- Plan document: [docs/plan/markdown-comment-extension.md](file:///Users/hudy/ws/depdok/docs/plan/markdown-comment-extension.md)
- Main guide in AGENTS.md: [AGENTS.md](file:///Users/hudy/ws/depdok/AGENTS.md)
