# Post-Mortem Report: Split Editor DOM Crash Issues (`NotFoundError`)

This document summarizes the technical issues, root causes, and resolution details encountered while implementing the VS Code-style split editor view in Depdok. These issues caused window crashes (uncaught DOM exceptions) when splitting panes multiple times or changing pane focus.

---

## Issue 1: Nested Resizable Panel Keying and Structural Errors
### Symptom
Splitting editors more than twice rapidly crashed the window with `NotFoundError: The object can not be found here` during React's DOM mutation commit phase.

### Root Cause
1. **Direct Children Violation**: The `react-resizable-panels` library requires that all `<ResizablePanel>` and `<ResizableHandle>` components be **direct children** of `<ResizablePanelGroup>`. In the initial draft of `PaneSplit.tsx`, they were wrapped inside React `<Fragment key={...}>` to map elements, which disrupted the library's internal DOM child-counting/inspection.
2. **Missing Group & Panel IDs**: In recursively nested layouts (e.g. a vertical split panel group nested inside a horizontal panel group), the resizable panels library requires stable, unique DOM `id` props to isolate and pair panels to their correct group context. Without these, the library auto-generated conflicting sequenced IDs that failed to match when the layout tree updated.

### Resolution
- Updated the `'split'` node type in [PaneStore.ts](file:///Users/hudy/ws/depdok/src/stores/PaneStore.ts) to define and store a stable, unique `id` generated via `createSplitId()`.
- Refactored [PaneSplit.tsx](file:///Users/hudy/ws/depdok/src/features/EditorWorkspace/PaneSplit.tsx) to construct a flat array of children, removing the `<Fragment>` wrappers.
- Passed unique, stable `id` props down:
  - `<ResizablePanelGroup id={node.id}>`
  - `<ResizablePanel id={`panel-${childId}`}>`
  - `<ResizableHandle id={`handle-${childId}`}>`

---

## Issue 2: Global State Leakage & View Hot-Swapping
### Symptom
Focusing an unfocused pane or opening a file of a different type (e.g. switching from Markdown to Todo) caused the non-focused pane to throw a `NotFoundError` and crash.

### Root Cause
Subcomponents inside the editor panes (like `MonacoEditor`, `PreviewFileWatcher`, `PreviewPanel`, `MarkdownPreview`, and `SideBySide`) were reading active file metadata directly from the global `editorStateAtom` instead of their pane-local tabs. 

When focus switched to a new pane and updated the global active file path, non-focused panes also received the new metadata. A non-focused pane would then attempt to hot-swap its component types in-place (e.g., trying to render `<TodoPreview>` inside a pane that was previously displaying `<MarkdownPreview>`). Because third-party editors (like Monaco and TipTap) directly mutate the DOM, React's unmounting cycle clashed with their self-destruction handlers, resulting in DOM sync mismatches.

### Resolution
- Decoupled all pane subcomponents from the global `editorStateAtom` by passing local `filePath` and `fileExtension` props derived directly from the pane's active tab in [EditorPane.tsx](file:///Users/hudy/ws/depdok/src/features/EditorWorkspace/EditorPane.tsx).
- Updated [MonacoEditor.tsx](file:///Users/hudy/ws/depdok/src/features/Editor/MonacoEditor.tsx), [SidebySide/index.tsx](file:///Users/hudy/ws/depdok/src/features/SidebySide/index.tsx), [PreviewFileWatcher.tsx](file:///Users/hudy/ws/depdok/src/features/Preview/PreviewFileWatcher.tsx), and [MarkdownPreview.tsx](file:///Users/hudy/ws/depdok/src/features/PreviewMarkdown/MarkdownPreview.tsx) to run their side effects (like file watching, formatting, and rendering) against these local props.

---

## Issue 3: TipTap Plugin Re-Initialization on Focus Switch
### Symptom
Clicking on a disabled split button (or focusing/unfocusing a pane that renders a Markdown file) crashed the window.

### Root Cause
In [MarkdownPreview.tsx](file:///Users/hudy/ws/depdok/src/features/PreviewMarkdown/MarkdownPreview.tsx), the `<MarkdownBubbleMenu>` and `<MarkdownDragHandle>` elements are only rendered when the pane is focused (`editable === true`). 

When these components mounted/unmounted, they passed inline object literals to their config props:
- `options={{ placement: 'top', offset: 8 }}` in `BubbleMenu`
- `computePositionConfig={{ placement: "left-start", ... }}` in `DragHandle`

Since these objects were recreated with a new memory reference on every render, it forced the TipTap editor to continuously destroy and recreate the underlying ProseMirror plugins. When the pane's focus transitioned, this destruction phase ran in parallel with React's DOM commit phase, causing React to attempt to remove DOM nodes that TipTap had already detached.

### Resolution
- Extracted both config objects into static constants (`BUBBLE_MENU_OPTIONS` and `DRAG_HANDLE_CONFIG`) outside the component rendering functions in [MarkdownBubbleMenu.tsx](file:///Users/hudy/ws/depdok/src/features/PreviewMarkdown/MarkdownBubbleMenu.tsx) and [MarkdownDragHandle.tsx](file:///Users/hudy/ws/depdok/src/features/PreviewMarkdown/MarkdownDragHandle.tsx).
- Since the reference is now stable, TipTap reuses the plugin instances instead of destroying them, allowing React to mount and unmount components safely without DOM conflicts.
