# Build a Comment Extension in Markdown using Tiptap

This plan outlines the architecture and implementation steps to build a robust comment extension for the Tiptap Markdown editor, meeting all the requirements specified in the design brief.

## User Review Required

> [!IMPORTANT]
> **Saving Comments Invisibly (Finalized Approach):** 
> To answer your concern about keeping the raw markdown readable in VS Code while saving comments invisibly in other markdown apps:
> 
> 1. **Inline Highlights:** We will use minimal HTML tags for the text selection, such as `<mark data-comment-id="123">hello world</mark>`. This keeps the raw text highly readable while providing the anchor for Tiptap to know exactly what text is commented on.
> 2. **Comment Data at the Bottom:** All comment threads (text, replies, author, state) will be saved in HTML comment blocks **at the very bottom** of the Markdown file. For example:
> ```markdown
> <!-- TIPTAP_COMMENT_123: {"text": "my comment", "replies": []} -->
> ```
> 
> **Why this is the best approach:**
> 1. **Clean Reading Experience:** By keeping the large JSON metadata at the bottom of the document, the main body of your markdown file stays clean and easy to read in VS Code.
> 2. **Invisible in other apps:** Standard markdown viewers completely ignore HTML comments. Your customers will never see the comment data at the bottom of the file when they open it.
> 3. **Easy Maintenance:** We will encapsulate all of this logic into a dedicated, self-contained Tiptap Extension (`src/features/PreviewMarkdown/extensions/CommentExtension.ts`) that handles both the inline `<mark>` tag parsing and extracting the comment blocks from the bottom of the document during serialization. 

## Open Questions

> [!WARNING]
> 1. Do you want to support commenting on block elements (like whole tables or images) in addition to text? (Adding a mark to block elements in ProseMirror can sometimes be tricky and might require node attributes instead of marks).
> 2. For the dashed yellow underscore, should this style only apply when viewing the document in our editor, or do we want to attempt to style it inline in the raw markdown so it might show up in other apps? (I recommend keeping it internal to our app using a CSS class).
> 3. Does the application currently have a global state manager (like Jotai) for the editor that we can hook the comment sidebar into?

## Proposed Changes

### Core Extension

#### [NEW] `src/features/PreviewMarkdown/extensions/CommentMark.ts`
Create a custom Tiptap Mark (`CommentMark`) that stores a `commentId` attribute.
- Add `parseHTML` and `renderHTML` to serialize this to a `<span data-comment-id="...">` element.
- Define custom ProseMirror plugins to handle click events on the mark, dispatching an event to the UI layer to highlight the corresponding comment in the sidebar.

#### [MODIFY] `src/features/PreviewMarkdown/Editor.tsx` (or where Tiptap is configured)
- Register the `CommentMark` extension.
- Intercept the Markdown `getMarkdown()` and `setContent()` flows to extract/inject the hidden HTML comment block that contains the comment JSON data.

### State Management

#### [NEW] `src/stores/commentStore.ts`
Create a Jotai store to manage:
- The array of comment threads (`id`, `text`, `replies`, `resolved`, `author`).
- The currently `activeCommentId` (for the bidirectional highlighting).
- The `isSidebarVisible` boolean state.

### UI Components

#### [MODIFY] `src/features/PreviewMarkdown/MarkdownBottomMenu.tsx`
- Add a toggle button to show/hide the comment sidebar on the right side.

#### [NEW] `src/features/PreviewMarkdown/components/CommentSidebar.tsx`
- Render a sidebar containing a list of `CommentThread` components.
- Subscribe to the `activeCommentId` to highlight the active comment (yellow background and border).
- Implement click handlers to set the `activeCommentId` and scroll the editor to the corresponding mark.

#### [NEW] `src/features/PreviewMarkdown/components/CommentThread.tsx`
- Display the comment text, resolve/delete actions, and a list of replies.
- Provide input fields to edit the comment or add a reply.

#### [NEW] `src/features/PreviewMarkdown/components/AddCommentBubble.tsx`
- A Tiptap `BubbleMenu` that appears when text is selected (and no comment currently exists).
- Shows the "Add comment" button.
- Clicking it opens a small popover/dialog to enter the initial comment text.

### Styles

#### [MODIFY] `src/features/PreviewMarkdown/markdown.css` (or relevant CSS)
- Add styles for the `.comment-mark` class:
  - Default: `border-bottom: 2px dashed yellow;`
  - Active (`.comment-mark.active`): `background-color: yellow;`
- Add layout styles to accommodate the resizable sidebar.

## Verification Plan

### Manual Verification
1. Open a markdown file, select some text, and click the "Add comment" bubble menu.
2. Type a comment and verify it appears in the right sidebar.
3. Verify the text in the editor gets a yellow dashed underline.
4. Click the text in the editor -> verify the sidebar comment highlights yellow.
5. Click the sidebar comment -> verify the text in the editor highlights yellow.
6. Add a reply, edit the comment, and mark it as resolved.
7. Save the document and view the raw markdown. Verify the comment thread data is hidden within an `<!-- HTML Comment -->` and the text is wrapped in a `<span>`.
8. Open the raw markdown in a standard viewer (like GitHub or VS Code preview) and verify the comments are completely invisible to the reader.
