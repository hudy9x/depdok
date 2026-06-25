# Split Editor / Split View — Implementation Plan v3

This revision keeps v2's data model and bug fixes, but closes gaps that left room for
Issue-2-shaped bugs (global-state leakage) to resurface in components v2 didn't name,
and makes several "derived atom" claims concrete enough to implement without guessing.

---

## Architecture Overview

### Recursive Pane Tree Data Model (unchanged from v2)

```ts
export type PaneDirection = 'horizontal' | 'vertical';

export interface Pane {
  id: string;
  tabs: Tab[];
  activeTabId: string | null;
  viewMode: ViewMode;
}

export type PaneNode =
  | { type: 'leaf'; pane: Pane }
  | { type: 'split'; id: string; direction: PaneDirection; children: PaneNode[]; sizes: number[] };
```

`viewMode` stays per-pane (v2's correct call — keeps Markdown/Todo switching from ever
touching global state again).

### State access rule (the actual fix, stated as a rule — not just a list of files)

> **No component that renders *inside* a leaf pane may read `editorStateAtom`,
> `activeTabAtom`, `tabsAtom`, or any other "current file" global. Every such component
> receives `filePath`, `tabId`, `fileExtension`, and `isDeleted` as props, sourced once at
> `EditorPane.tsx` from that pane's own tree node.**

This is the rule v2 implemented for *most* components but didn't write down as a rule,
which is how `EditorBreadcrumbs` and `EditorViewMode` fell through the file map. Stating
it explicitly makes it auditable: for any new component added later, the question is
"does it render inside a leaf pane?" — if yes, it follows the rule, full stop.

### `tabsAtom` / `activeTabIdAtom`: atom family, not a single derived atom

v2 said these are "derived... mapping to the pane tree" without specifying shape. That's
ambiguous in a way that matters: if `tabsAtom` derives from the *focused* pane only,
`EditorTabs/index.tsx` (scoped per `paneId`) would render the wrong tabs for every
non-focused pane — the exact shape of the Issue 2 bug, just in the tab bar instead of
the editor content.

**Concrete fix:** use an atom family keyed by `paneId`:

```ts
export const paneTabsAtomFamily = atomFamily((paneId: string) =>
  atom((get) => {
    const node = findPaneNode(get(paneTreeAtom), paneId);
    return node?.type === 'leaf' ? node.pane.tabs : [];
  })
);

export const paneActiveTabIdAtomFamily = atomFamily((paneId: string) =>
  atom((get) => {
    const node = findPaneNode(get(paneTreeAtom), paneId);
    return node?.type === 'leaf' ? node.pane.activeTabId : null;
  })
);
```

The legacy global `tabsAtom` / `activeTabIdAtom` names are kept only as aliases for the
*focused* pane's family member, for any code that genuinely needs "the current file"
(e.g. window title, URL sync) — never for anything that renders inside a specific pane.

---

## Bug Resolutions (v1 → v2 → v3)

### Issue 1: Nested Resizable Panel Keying and Structural Errors
Unchanged from v2 — `split` nodes carry a stable `id`, `PaneSplit.tsx` builds a flat
child array. One addition, since v2 didn't specify it:

**`childId` derivation** — a split's children can themselves be leaves or splits, so the
key/id source differs per case:

```tsx
function childId(node: PaneNode): string {
  return node.type === 'leaf' ? node.pane.id : node.id;
}
```

`<ResizablePanel id={`panel-${childId(child)}`}>` and the matching handle id both use
this helper, so nested splits-of-splits get the same collision-proof IDs leaves get.

### Issue 2: Global State Leakage & View Hot-Swapping
Same fix as v2 (local props from the pane's active tab), but the **component audit is
now exhaustive** — see File Map below. `EditorBreadcrumbs.tsx` and `EditorViewMode.tsx`
are added; both rendered per-leaf-pane in v1's component tree but were absent from v2's
modified-files list.

### Issue 3: TipTap Plugin Re-Initialization on Focus Switch
Unchanged from v2 — static `BUBBLE_MENU_OPTIONS` / `DRAG_HANDLE_CONFIG` constants.

---

## File Map

### New Files
*(same as v2)*

| File | Purpose |
|---|---|
| `src/stores/PaneStore.ts` | State definition, action atoms, atom families, tree traversal helpers. |
| `src/features/EditorWorkspace/index.tsx` | Entry point of the split workspace, initializing/restoring the tree. |
| `src/features/EditorWorkspace/PaneTree.tsx` | Recursive node-type dispatcher. |
| `src/features/EditorWorkspace/PaneSplit.tsx` | Wraps `react-resizable-panels` with flat child mapping + `childId()` helper. |
| `src/features/EditorWorkspace/EditorPane.tsx` | Renders a leaf pane; single source of local props for everything beneath it. |
| `src/features/EditorWorkspace/SplitPaneButton.tsx` | Tab bar split trigger button. |

### Modified Files — additions vs. v2 marked **NEW**

| File | Change |
|---|---|
| `src/stores/TabStore.ts` | **NEW SPEC:** `paneTabsAtomFamily` / `paneActiveTabIdAtomFamily` keyed by `paneId`; legacy global names alias the focused pane only. |
| `src/stores/EditorStore.ts` | Derive `editorStateAtom` from focused pane's active tab (compat shim only — not for in-pane consumers); `activeFileContentsAtom` cache. |
| `src/pages/Editor.tsx` | Mount `<EditorWorkspace />`; sync **focused pane's** active tab to URL params. |
| `src/features/Editor/useAutoSave.ts` | Accept `filePath`, `tabId`, `isDeleted` params; debounced callback closes over these. |
| `src/features/Editor/MonacoEditor.tsx` | Accept `filePath`, `tabId`, `isDeleted` props. |
| `src/features/SidebySide/index.tsx` | Pass `filePath`, `tabId`, `isDeleted` down. |
| `src/features/Preview/PreviewPanel.tsx` | Route `filePath` to `MarkdownPreview` / `TodoPreview`. |
| `src/features/Preview/PreviewFileWatcher.tsx` | Accept `filePath` prop instead of reading `editorStateAtom`. |
| `src/features/PreviewMarkdown/MarkdownPreview.tsx` | Use local `filePath` / `tabId` props. |
| `src/features/PreviewMarkdown/MarkdownBubbleMenu.tsx` | Extract `BUBBLE_MENU_OPTIONS` static constant. |
| `src/features/PreviewMarkdown/MarkdownDragHandle.tsx` | Extract `DRAG_HANDLE_CONFIG` static constant. |
| `src/features/PreviewTodo/TodoPreview.tsx` | Accept and pass `filePath` down. |
| `src/features/PreviewTodo/useTodoDocument.ts` | Use `filePath` for draft saving key. |
| `src/features/EditorTabs/index.tsx` | Scope rendering to `paneId` via `paneTabsAtomFamily(paneId)`. |
| `src/features/EditorTabs/TabItem.tsx` | Check active status against `paneActiveTabIdAtomFamily(paneId)`. |
| `src/features/EditorTabs/TabContextMenu.tsx` | Add "Split Right" / "Split Down". |
| **`src/features/EditorBreadcrumbs.tsx`** | **NEW.** Accept local `filePath` prop instead of reading `editorStateAtom`. |
| **`src/features/EditorViewMode.tsx`** | **NEW.** Read/write the pane's own `viewMode` field, not a global. |
| `src/hooks/useFileWatcher.ts` | Accept `isDirty` prop, checked per pane. |
| `src/hooks/useGlobalShortcuts.ts` | Map `Cmd+\`/`Ctrl+\` (horizontal), `Cmd+Shift+\`/`Ctrl+Shift+\` (vertical), `Cmd+1/2/3` (focus) to pane store actions. |
| `src/hooks/useProjectStateSync.ts` | Persist/reload `paneTreeAtom` instead of `tabsAtom`. |
| `src/features/FileExplorer` | `Alt+Click` opens files in new splits. |

---

## Edge Cases (restored from v1, carried forward — these are not optional)

| Case | Handling |
|---|---|
| Close last tab in a pane | Collapse the pane; if it's the only pane, show empty-state UI |
| Split a split (recursive) | Naturally supported — each child of a split node is itself a `PaneNode` |
| Same file open in two panes | Both point to the same IndexedDB draft key; edits auto-save and reflect in the other pane on next focus |
| Closing focused pane | Move focus to nearest sibling leaf first, then collapse |
| Minimum pane width | `ResizablePanel minSize={10}` (≈80px at 800px window) |
| Cmd+S on unfocused file | Always saves the **focused** pane's active file, via `paneActiveTabIdAtomFamily` of the focused pane only |
| URL sync (`/editor?path=...`) | Reflects focused pane's active tab only; deep-links open in the primary pane |
| Performance | Soft cap of 4 simultaneous panes (each mounts a full Monaco instance) |
| Rapid sequential splitting | Each split assigns its `id` synchronously before the next split action can fire — no two splits should ever race on `createSplitId()` |
| Focus switch mid-debounced-save | `useAutoSave`'s closed-over `tabId`/`filePath` must match the save's origin pane even if focus has since moved — verified by Issue 2 fix, but worth a dedicated test (see checklist) |

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+\` / `Ctrl+\` | Split focused pane (horizontal) |
| `Cmd+Shift+\` / `Ctrl+Shift+\` | Split focused pane (vertical) |
| `Cmd+1` / `Cmd+2` / `Cmd+3` | Focus pane 1 / 2 / 3 |
| `Alt+Click` (file in sidebar) | Open file in a new split pane |

---

## Verification Checklist — targets the actual post-mortem repro steps

General:
- [ ] Splitting a pane creates a sibling layout dynamically
- [ ] Dragging split dividers works smoothly
- [ ] Reload restores pane layout, tabs, sizes
- [ ] `Cmd+S` saves only the focused pane's active file

Issue 1 repro (rapid multi-split crash):
- [ ] Split the same pane **3+ times in rapid succession** (no pause between clicks) — no `NotFoundError`
- [ ] Create a split-of-a-split (vertical nested inside horizontal) and resize both levels independently
- [ ] Repeat the above with `Cmd+\` held/repeated rather than mouse clicks

Issue 2 repro (focus + type-switching crash):
- [ ] Open a Markdown file in pane A, a Todo file in pane B; rapidly alternate focus between them with `Cmd+1`/`Cmd+2`
- [ ] In a focused pane, switch the open file from Markdown → Todo → Markdown without changing focus
- [ ] Confirm breadcrumbs and the view-mode switcher show pane-local state, not the globally-last-focused pane's, when two panes show different file types side by side

Issue 3 repro (TipTap teardown crash):
- [ ] Focus a Markdown pane (bubble menu + drag handle mount), then immediately unfocus it by clicking another pane — repeat 10x rapidly
- [ ] With a Markdown pane focused and its bubble menu visible, trigger a split or close of a *different* pane at the same time

Sign-off:
- [ ] All of the above pass with React StrictMode / double-render enabled, not just production build