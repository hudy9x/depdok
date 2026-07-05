# Shared File Content Sync Plan

## Problem Statement

Two distinct bugs exist in the current editor/preview data flow:

### Bug 1 – Multiple tabs for the same file path fall out of sync

When the same file is opened in two or more tabs (across one or multiple panes), only the tab that receives the edit is updated. The other tabs show stale content and have the wrong dirty state.

**Steps to reproduce:**
1. Open `file.md` in Pane 1.
2. Split pane and open `file.md` again in Pane 2.
3. Edit the file in Pane 1.
4. Switch to Pane 2 – tab still shows the original content; dirty indicator is absent.

### Bug 2 – Switching view modes loses in-memory edits

When a user edits content in one mode (`editor-only`, `preview-only`, or `side-by-side`) and then switches to another mode, the newly-mounted mode starts with the original `initialContent` captured at tab open time, discarding any unsaved in-memory edits.

**Steps to reproduce:**
1. Open a `.md` file and switch to `preview-only` mode.
2. Edit in the preview.
3. Toggle to `editor-only` mode – Monaco mounts with the stale original content.
4. (Same in reverse: edit in editor, switch to preview.)

---

## Root Cause Analysis

### Data flow today

```
Disk / IndexedDB draft
        │
        ▼
LoadFileContent (own local useState)
        │  initialContent (value at mount time — never refreshed)
        ▼
┌───────────────────────────────────────────────┐
│  EditorPane (viewMode switch)                 │
│  ┌──────────────────────────────────────────┐ │
│  │ editor-only  → MonacoEditor              │ │  own local useState(initialContent)
│  │ side-by-side → SideBySide → MonacoEditor │ │  own local useState(initialContent)
│  │ preview-only → PreviewFileWatcher        │ │  own local useState(initialContent)
│  │               → PreviewPanel             │ │
│  └──────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘

On every edit (any mode):
  handleContentChange → setActiveFileContent
    → liveFilesContentAtom[filePath] = newValue   ✅ shared by path
    → markTabAsDirty(activeTabId only)             ❌ only this tab
    → draftService.saveDraft(filePath, content)    ✅ shared by path

LoadFileContent never reads liveFilesContentAtom after mount.
⇒ liveFilesContentAtom is populated correctly but nothing reads it back.
```

### Why Bug 1 happens

`markTabAsDirty` is called with only the active tab's `tabId`. Every other tab sharing the same `filePath` is never notified. Each `LoadFileContent` instance keeps its own frozen local state from mount time — the second tab was hydrated from disk/draft when it first opened and never re-reads the atom.

### Why Bug 2 happens

`LoadFileContent` wraps all three mode panels and stays mounted across mode switches. Its `content` state is set exactly once in the `useEffect` triggered by `filePath` changes. When the user edits in `preview-only`, `liveFilesContentAtom[filePath]` is updated, but `LoadFileContent.content` is never updated. When the mode switches and the new component mounts, it receives the stale `initialContent`.

---

## Solution Overview

Two orthogonal changes fix both bugs cleanly:

| Change | Fixes |
|--------|-------|
| Introduce `DirtyStore.ts` — a path-keyed set replacing `Tab.isDirty` | Bug 1 (multi-tab dirty state) |
| `LoadFileContent` subscribes to `liveFilesContentAtom[filePath]` after initial load | Bug 2 (mode-switch stale content) |

`liveFilesContentAtom` already exists as a path-keyed content map. The missing pieces are: (a) reading it back into `LoadFileContent` after hydration, and (b) moving dirty state out of the tab object and into its own path-keyed store.

---

## Implementation Plan

### Step 1 — Create a centralized `DirtyStore.ts`

**File:** `src/stores/DirtyStore.ts` *(new file)*

Dirty state is fundamentally **per file path**, not per tab. A tab is a view into a file; whether that file has unsaved changes should not live on the tab object. Moving dirty state to a dedicated path-keyed store means:

- All tabs (across all panes) that show the same file automatically share the same dirty state — no tree walk needed.
- `Tab.isDirty` is removed from the `Tab` interface in `TabStore.ts`.
- The existing `markTabAsDirtyAtom` / `markTabAsSavedAtom` atoms are removed.

```ts
import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';

// Central store: set of file paths that have unsaved changes
export const dirtyFilesAtom = atom<Set<string>>(new Set<string>());

// Mark a file path as dirty
export const markFileAsDirtyAtom = atom(null, (get, set, filePath: string) => {
  const prev = get(dirtyFilesAtom);
  if (prev.has(filePath)) return; // no-op if already dirty
  set(dirtyFilesAtom, new Set(prev).add(filePath));
});

// Mark a file path as clean/saved
export const markFileAsSavedAtom = atom(null, (get, set, filePath: string) => {
  const prev = get(dirtyFilesAtom);
  if (!prev.has(filePath)) return; // no-op if already clean
  const next = new Set(prev);
  next.delete(filePath);
  set(dirtyFilesAtom, next);
});

// Per-path derived atom for cheap reactive reads in components
export const isFileDirtyAtom = atomFamily((filePath: string) =>
  atom((get) => get(dirtyFilesAtom).has(filePath))
);
```

---

### Step 2 — Remove `isDirty` from the `Tab` interface

**File:** `src/stores/TabStore.ts`

```diff
  export interface Tab {
    id: string;
    filePath: string;
    fileName: string;
    fileExtension: string | null;
-   isDirty: boolean;
    isActive: boolean;
    isPreview: boolean;
    lineNumber?: number;
    isDeleted?: boolean;
  }
```

- Remove `markTabAsDirtyAtom` and `markTabAsSavedAtom` entirely.
- Remove `isDirty: false` from the `newTab` object in `createTabAtom`.
- In `markTabsDeletedByPrefixAtom`, remove `isDirty: true` from the tab update; instead call `markFileAsDirtyAtom(tab.filePath)` for each matched tab.

---

### Step 3 — Update `useAutoSave.ts`

**File:** `src/features/Editor/useAutoSave.ts`

```diff
- import { activeTabAtom, isDummyPath, markTabAsDirtyAtom, markTabAsSavedAtom } from "@/stores/TabStore";
+ import { activeTabAtom, isDummyPath } from "@/stores/TabStore";
+ import { markFileAsDirtyAtom, markFileAsSavedAtom } from "@/stores/DirtyStore";

  // inside useAutoSave():
- const markTabAsDirty = useSetAtom(markTabAsDirtyAtom);
- const markTabAsSaved = useSetAtom(markTabAsSavedAtom);
+ const markDirty = useSetAtom(markFileAsDirtyAtom);
+ const markSaved = useSetAtom(markFileAsSavedAtom);

  // in debouncedSaveDraft callback:
- markTabAsDirty(paneId ? { tabId, paneId } : tabId);
+ markDirty(filePath);

  // in debouncedAutoSave callback (after successful write):
- markTabAsSaved(paneId ? { tabId, paneId } : tabId);
+ markSaved(filePath);
```

---

### Step 4 — Update `EditorStore.ts`

**File:** `src/stores/EditorStore.ts`

`editorStateAtom.isDirty` stays in the `EditorState` interface — only its **source** changes. The toolbar and left-actions components read `editorState.isDirty` and need no changes.

```diff
- import { activeTabAtom, markTabAsDirtyAtom, markTabAsSavedAtom } from './TabStore';
+ import { activeTabAtom } from './TabStore';
+ import { dirtyFilesAtom, markFileAsDirtyAtom, markFileAsSavedAtom } from './DirtyStore';

  export const editorStateAtom = atom<EditorState>((get) => {
    const activeTab = get(activeTabAtom);
    ...
    return {
      filePath: activeTab ? activeTab.filePath : null,
      fileExtension: activeTab ? activeTab.fileExtension : null,
-     isDirty: activeTab ? activeTab.isDirty : false,
+     isDirty: activeTab ? get(dirtyFilesAtom).has(activeTab.filePath) : false,
      lastSaved: null,
      viewMode,
    };
  });

  export const markAsDirtyAtom = atom(null, (get, set) => {
    const activeTab = get(activeTabAtom);
-   if (activeTab) set(markTabAsDirtyAtom, activeTab.id);
+   if (activeTab) set(markFileAsDirtyAtom, activeTab.filePath);
  });

  export const markAsSavedAtom = atom(null, (get, set) => {
    const activeTab = get(activeTabAtom);
-   if (activeTab) set(markTabAsSavedAtom, activeTab.id);
+   if (activeTab) set(markFileAsSavedAtom, activeTab.filePath);
  });
```

---

### Step 5 — Update UI consumers to read from `isFileDirtyAtom`

#### `src/features/EditorTabs/TabItem.tsx`

```diff
+ import { useAtomValue } from 'jotai';
+ import { isFileDirtyAtom } from '@/stores/DirtyStore';

  export function TabItem({ tab, paneId, isActive }) {
+   const isDirty = useAtomValue(isFileDirtyAtom(tab.filePath));

    const handleClose = (e: React.MouseEvent) => {
      e.stopPropagation();
-     if (tab.isDirty) {
+     if (isDirty) {
        setShowCloseWarning(true);
      } else {
        closeTab({ tabId: tab.id, paneId });
      }
    };
    ...
-   {tab.isDirty && <div className="w-2 h-2 rounded-full bg-blue-500/80 ..." />}
+   {isDirty && <div className="w-2 h-2 rounded-full bg-blue-500/80 ..." />}
  }
```

#### `src/hooks/useFileWatcher.ts`

```diff
+ import { useAtomValue } from 'jotai';
+ import { isFileDirtyAtom } from '@/stores/DirtyStore';

  export function useFileWatcher({ filePath, ... }) {
+   const isFileDirty = useAtomValue(isFileDirtyAtom(filePath));

-   console.log("... IsDirty:", activeTab.isDirty);
+   console.log("... IsDirty:", isFileDirty);

-   if (activeTab.isDirty) {
+   if (isFileDirty) {
```

#### `src/features/Editor/LoadFileContent.tsx`

`onMetadataLoad` currently passes `isDirty: !!draft`. Replace with a direct `markFileAsDirtyAtom` call and remove the `isDirty` field from `onMetadataLoad`'s signature.

```diff
+ import { markFileAsDirtyAtom } from '@/stores/DirtyStore';

  export function LoadFileContent({ filePath, isDeleted, onMetadataLoad, children }) {
+   const markDirty = useSetAtom(markFileAsDirtyAtom);
    ...
    if (!isImage && draft) {
      if (isUntitled || draft.content !== loadedFileContent) {
        contentToLoad = draft.content;
+       markDirty(filePath);
      }
    }
  }
```

`EditorLeftActions.tsx` and `EditorToolbar.tsx` read `editorState.isDirty` (updated in Step 4) — no changes needed.

---

### Step 6 — Make `LoadFileContent` subscribe to `liveFilesContentAtom`

**File:** `src/features/Editor/LoadFileContent.tsx`

After the initial load completes, `LoadFileContent` must subscribe to `liveFilesContentAtom[filePath]` so it passes the latest content to whichever mode is currently mounted. This fixes mode-switch staleness automatically because all three mode components (`MonacoEditor`, `SideBySide`, `PreviewFileWatcher`) already react to `initialContent` prop changes.

Rules to avoid feedback loops:
- Only apply the live value **after** the initial load finishes (`isLoading === false`).
- Only update when the live value **differs** from local state (the change came from outside this instance).
- Omit `content` from the dep-array to prevent the effect from re-running on local writes.

```diff
- import { useSetAtom } from "jotai";
+ import { useAtomValue, useSetAtom } from "jotai";
  import { activeFileContentAtom, liveFilesContentAtom } from "@/stores/EditorStore";

  export function LoadFileContent({ filePath, isDeleted, onMetadataLoad, children }) {
    const [content, setContent] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const setActiveFileContent = useSetAtom(activeFileContentAtom);
+   const liveFiles = useAtomValue(liveFilesContentAtom);

+   // After initial load, keep local state in sync with live atom changes for this path.
+   // `content` is intentionally excluded from deps — it is the guard value, not the trigger.
+   useEffect(() => {
+     if (isLoading) return;
+     const liveValue = liveFiles[filePath];
+     if (liveValue !== undefined && liveValue !== content) {
+       setContent(liveValue);
+     }
+   }, [liveFiles, filePath]);

    // existing initial load effect unchanged ...
  }
```

---

### Step 7 — Guard `MonacoEditor` against unnecessary re-init

**File:** `src/features/Editor/MonacoEditor.tsx`

When `LoadFileContent` pushes a new `initialContent` (from a sibling pane editing the same file), the existing `useEffect` would reset Monaco mid-session, wiping the cursor position and undo stack. Add a guard that skips the reset when Monaco's live value already matches:

```diff
  useEffect(() => {
+   const currentEditorValue = editorRef.current?.getValue();
+   if (currentEditorValue === initialContent) return;
    setContent(initialContent);
  }, [initialContent]);
```

- On **mount** (`editorRef.current` is null): `undefined ≠ initialContent` — runs correctly.
- On **external change** from sibling pane: content differs — runs correctly.
- On **own keystrokes** reflected back through the atom: Monaco already equals `initialContent` — no-op.

---

### Step 8 — `SideBySide` and `PreviewFileWatcher` (no changes needed)

Both already have:

```ts
useEffect(() => { setContent(initialContent); }, [initialContent]);
```

Step 6 keeps `initialContent` current, so these components receive updates automatically.

---

## File Change Summary

| File | Change | Purpose |
|------|--------|---------|
| `src/stores/DirtyStore.ts` | **New file** | Central path-keyed dirty state store |
| `src/stores/TabStore.ts` | Remove `Tab.isDirty`, remove two atoms | Dirty state no longer lives on the tab |
| `src/stores/EditorStore.ts` | Read `dirtyFilesAtom`, update shims | Surface dirty state from the new store |
| `src/features/Editor/useAutoSave.ts` | Swap two `useSetAtom` calls | Write dirty/saved to path-keyed store |
| `src/features/EditorTabs/TabItem.tsx` | Read `isFileDirtyAtom` | Reactive per-path dirty indicator and close guard |
| `src/hooks/useFileWatcher.ts` | Read `isFileDirtyAtom` | Auto-reload guard uses path-keyed dirty flag |
| `src/features/Editor/LoadFileContent.tsx` | Add `useEffect` + `useAtomValue` + `markDirty` | Subscribe to live content; mark dirty from draft |
| `src/features/Editor/MonacoEditor.tsx` | Guard existing `useEffect` | Prevent editor reset when sibling pane edits same file |

---

## Store Relationship After Fix

```
DirtyStore (dirtyFilesAtom — Set<filePath>)
    ├── isFileDirtyAtom(path)      → TabItem (dot indicator, close warning)
    │                              → useFileWatcher (auto-reload guard)
    └── dirtyFilesAtom.has(path)   → editorStateAtom.isDirty
                                   → EditorLeftActions, EditorToolbar

liveFilesContentAtom (Record<filePath, string>)
    ├── written by: handleContentChange (useAutoSave) — any mode, any pane
    └── read by: LoadFileContent (after mount) → initialContent prop
                    → MonacoEditor / SideBySide / PreviewFileWatcher
```

---

## Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| Feedback loop in `LoadFileContent` | Guard `liveValue !== content` + exclude `content` from dep-array |
| Monaco cursor/undo reset when sibling pane edits same file | Step 7 guard no-ops when Monaco already has same content |
| `markTabsDeletedByPrefixAtom` no longer sets `isDirty` on tab | Replaced by calling `markFileAsDirtyAtom(tab.filePath)` for each matched tab |
| Draft service divergence (IndexedDB is path-keyed) | Already path-keyed — no change needed |
| `EditorStore.markAsDirtyAtom` still used elsewhere | Delegates to `markFileAsDirtyAtom` after Step 4 — no callers break |

---

## Testing Checklist

- [ ] Open the same file in two panes → edit in one → second pane tab shows dirty dot
- [ ] Open the same file in two panes → edit in one → switch to the second pane → content is current
- [ ] Edit in `preview-only` mode → switch to `editor-only` → Monaco shows the latest content
- [ ] Edit in `editor-only` mode → switch to `preview-only` → preview renders the latest content
- [ ] Edit in `side-by-side` mode → switch to `preview-only` → preview renders the latest content
- [ ] Auto-save completes → all tabs with the same path show clean (no dirty dot)
- [ ] External file change (Tauri file watcher) still reloads correctly
- [ ] Typing in editor does not reset Monaco cursor or clear undo history
- [ ] Closing a dirty tab still shows the "unsaved changes" warning dialog
