# Split Editor / Split View — Implementation Plan

## Goal

Add VS Code-style split editor panes to depdok. The user can divide the editor area into multiple
independent panes — each with its own tab list, scroll position, and cursor state. Panes can be
split recursively and resized via a draggable divider.

---

## Trigger

A **split icon button** (`SplitSquareHorizontal` from lucide-react) placed at the **right end of
each pane's tab bar**, outside the scrollable tab list so it stays pinned regardless of tab count.

```
[tab1 ×] [tab2 ×] [tab3 ×] ··  [+]          [⊟]
                                 ↑             ↑
                            CreateTabButton   SplitButton (NEW)
```

Additional triggers:
- Keyboard: `Cmd+\` / `Ctrl+\` (split focused pane horizontally)
- Right-click tab → context menu → "Split Right" / "Split Down"
- `Alt+Click` a file in the File Explorer → opens it in a new split pane

---

## Architecture

### Current State (the problem)

All editor state is **singleton** — only one tab list, one active file, one editor at a time.

| Concern | Where | Issue |
|---|---|---|
| Tab list | `tabsAtom` (global) | Only one list for the whole app |
| Active tab | `activeTabIdAtom` (global) | Only one "current" tab |
| Editor state | `editorStateAtom` (global) | Only one filePath / extension |
| Auto-save | `useAutoSave` → reads `editorStateAtom.filePath` | Tied to single file |
| Save handler | `EditorSaveHandler` → reads `activeTabAtom` | Saves single file |
| Layout | One `PanelSectionItem flex={1}` in `Editor.tsx` | No concept of pane |

### Pane Tree Data Model

The pane layout is stored as a **recursive tree** in a new global Jotai atom:

```ts
interface Pane {
  id: string;
  tabs: Tab[];
  activeTabId: string | null;
}

type PaneNode =
  | { type: 'leaf'; pane: Pane }
  | { type: 'split'; direction: 'horizontal' | 'vertical'; children: PaneNode[]; sizes: number[] };
```

A `focusedPaneIdAtom` tracks which pane currently has keyboard focus. Derived atoms supply
`EditorSave` and `useAutoSave` with the focused pane's active tab — replacing the old global
`activeTabAtom`.

---

## File Map

### New Files

| File | Purpose |
|---|---|
| `src/stores/PaneStore.ts` | Recursive pane tree atom, all pane actions |
| `src/features/EditorWorkspace/index.tsx` | Top-level pane layout orchestrator |
| `src/features/EditorWorkspace/PaneTree.tsx` | Recursive renderer (`leaf → EditorPane`, `split → PaneSplit`) |
| `src/features/EditorWorkspace/PaneSplit.tsx` | Wraps `react-resizable-panels` for a split node |
| `src/features/EditorWorkspace/EditorPane.tsx` | Single leaf pane (tab bar + editor content) |
| `src/features/EditorWorkspace/SplitPaneButton.tsx` | The split icon button in the tab bar |
| `src/features/EditorTabs/EditorTabsPane.tsx` | Pane-scoped version of `EditorTabs/index.tsx` |

### Modified Files

| File | Change |
|---|---|
| `src/stores/TabStore.ts` | Keep types/helpers; action atoms delegate to `PaneStore` |
| `src/stores/EditorStore.ts` | `editorStateAtom` derived from focused pane's active tab |
| `src/pages/Editor.tsx` | Replace single editor column with `<EditorWorkspace />` |
| `src/features/EditorTabs/TabItem.tsx` | Accept optional `paneId`; dispatch scoped actions |
| `src/features/EditorTabs/TabContextMenu.tsx` | Add "Split Right" / "Split Down" items |
| `src/features/Editor/useAutoSave.ts` | Read `focusedActiveTabAtom` instead of global atom |
| `src/features/Editor/EditorSaveHandler.tsx` | Read `focusedActiveTabAtom` instead of global atom |
| `src/hooks/useGlobalShortcuts.ts` | Add `Cmd+\`, `Cmd+1/2/3` shortcuts |
| `src/features/FileExplorer` (file item) | `Alt+Click` opens file in new split pane |

---

## Component Tree (after)

```
Editor.tsx
├── <FileSearchDialog />           (unchanged, global)
├── <ContentSearchDialog />        (unchanged, global)
├── <BranchSelectorDialog />       (unchanged, global)
├── <EditorSave />                 (reads focused pane)
│
└── PanelSectionGroup              (sidebar + editor area)
    ├── PanelSectionItem           (sidebar — unchanged)
    │   └── <FileExplorer />
    │
    └── EditorWorkspace            ← NEW (replaces the single content PanelSectionItem)
        └── PaneTree (root)
            ├── [leaf] EditorPane
            │   ├── EditorTabsPane    ← scoped tab bar
            │   │   ├── TabItem × N
            │   │   ├── CreateTabButton
            │   │   └── SplitPaneButton   ← NEW
            │   ├── EditorBreadcrumbs
            │   ├── EditorViewMode
            │   └── LoadFileContent
            │       └── MonacoEditor / PreviewPanel / SideBySide
            │
            └── [split] PaneSplit
                ├── ResizablePanelGroup (direction=horizontal|vertical)
                │   ├── ResizablePanel → PaneTree (child 0)
                │   ├── ResizableHandle
                │   └── ResizablePanel → PaneTree (child 1)
                └── (children are themselves PaneTree nodes → recursive)
```

---

## Key Libraries

`react-resizable-panels` is **already installed** (`^3.0.3`) and already wrapped in
`src/components/ui/resizable.tsx`. No new dependency needed.

---

## State Persistence

`paneTreeAtom` uses `atomWithStorage` backed by `sessionStorageDriver` (same pattern as
the existing `tabsAtom`). The full tree — tab lists, active tab IDs, pane sizes — is restored
on app reload within the same session.

---

## Edge Cases

| Case | Handling |
|---|---|
| Close last tab in a pane | Collapse the pane; if it's the only pane, show empty-state UI |
| Split a split (recursive) | Naturally supported — each child of a split node is itself a `PaneNode` |
| Same file open in two panes | Both point to the same IndexedDB draft key; edits auto-save and are reflected in the other pane on next focus (VS Code behavior) |
| Closing focused pane | Move focus to nearest sibling leaf first, then collapse |
| Minimum pane width | `ResizablePanel minSize={10}` (≈ 80px at 800px window) |
| Cmd+S on unfocused file | Always saves the **focused** pane's active file |
| URL sync (`/editor?path=...`) | URL reflects the focused pane's active tab; deep-links open in the primary pane |
| Performance | Recommend a soft cap of 4 simultaneous panes (each mounts a full Monaco instance) |

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+\` / `Ctrl+\` | Split focused pane (horizontal) |
| `Cmd+Shift+\` / `Ctrl+Shift+\` | Split focused pane (vertical) |
| `Cmd+1` | Focus pane 1 |
| `Cmd+2` | Focus pane 2 |
| `Cmd+3` | Focus pane 3 |
| `Alt+Click` (file in sidebar) | Open file in a new split pane |

---

## Implementation Order

1. **`PaneStore.ts`** — define the data model and all action atoms
2. **`EditorWorkspace/index.tsx`** + **`PaneTree.tsx`** — recursive renderer skeleton
3. **`EditorPane.tsx`** — leaf pane with wired-up scoped tab bar and editor content
4. **`PaneSplit.tsx`** + **`SplitPaneButton.tsx`** — split trigger and resizable container
5. **`EditorTabsPane.tsx`** + modify **`TabItem.tsx`** — pane-scoped tab actions
6. **`Editor.tsx`** — swap in `EditorWorkspace`
7. Migrate **`useAutoSave`**, **`EditorSaveHandler`**, **`EditorStore`** to focused-pane atoms
8. Add **keyboard shortcuts** and **Alt+Click** in explorer
9. Add **"Split Right/Down"** to `TabContextMenu`
10. **QA** — manual verification checklist

---

## Manual Verification Checklist

- [ ] Split button appears pinned at the right of each pane's tab bar
- [ ] Clicking split creates two panes side-by-side with the same file
- [ ] Each pane navigates independently
- [ ] Divider is draggable and resizes panes
- [ ] Closing a pane collapses layout; remaining pane expands
- [ ] `Cmd+\` splits the focused pane via keyboard
- [ ] `Cmd+1` / `Cmd+2` switch pane focus
- [ ] `Alt+Click` in explorer opens file in a new split
- [ ] `Cmd+S` saves the focused pane's active file only
- [ ] Reload restores pane layout, tabs, and sizes
- [ ] Right-click tab → "Split Right" and "Split Down" work
