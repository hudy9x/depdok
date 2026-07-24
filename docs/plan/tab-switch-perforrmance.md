# Tab Switching Performance Optimization — Revised Plan

Achieve **<16ms** (single-frame) tab switching, matching VS Code's instant-feel behavior. This revises and extends the [existing plan](file:///Users/hudy/ws/depdok/docs/plan/tab-switch-perforrmance.md).

## Current Bottleneck Analysis

After tracing through the rendering pipeline via GitNexus:

```
PaneTree → EditorPane → LoadFileContent → MonacoEditor / PreviewPanel
```

There are **three serial bottlenecks** that make every tab switch cost 300–500ms:

| # | Bottleneck | Location | Cost |
|---|-----------|----------|------|
| 1 | **Full unmount + remount** of editor/preview | [EditorPane.tsx](file:///Users/hudy/ws/depdok/src/features/EditorWorkspace/EditorPane.tsx#L83-L149) renders only `activeTab`; switching destroys the previous Monaco/Tiptap instance and builds a new one | **150–300ms** (Monaco init + Tiptap 20+ extensions) |
| 2 | **Async loading flash** — `isLoading=true` → `null` → await disk + IndexedDB | [LoadFileContent.tsx](file:///Users/hudy/ws/depdok/src/features/Editor/LoadFileContent.tsx#L56-L146) always resets to loading state even when content is cached in `liveFilesContentAtom` | **50–150ms** (IPC + IndexedDB) |
| 3 | **State loss** — scroll, cursor, undo history, selection all reset | [MonacoEditor.tsx](file:///Users/hudy/ws/depdok/src/features/Editor/MonacoEditor.tsx) re-creates editor from scratch; Tiptap `useEditor` re-initializes extensions | **~50ms** + UX degradation |

**Total: ~300–500ms of janky, blank-screen switching.**

---

## How VS Code Does It (Reference Architecture)

1. **DOM Keep-Alive**: Inactive editor containers get `display: none`. Zero teardown, zero init.
2. **In-Memory Model Cache**: `ITextModel` instances stay in memory. Tab switch = pointer swap.
3. **View State Restore**: `IEditorViewState` (cursor, scroll, folds) auto-persists because the DOM is alive.

---

## Proposed Changes

### Phase 1: Keep-Alive DOM Retention (biggest impact ~250ms saved)

#### [MODIFY] [EditorPane.tsx](file:///Users/hudy/ws/depdok/src/features/EditorWorkspace/EditorPane.tsx)

**Current behavior**: Only the `activeTab` is rendered. Switching tabs unmounts the previous editor tree and mounts a new one.

**New behavior**: Render a container `<div>` for **every visited tab** in the pane. Toggle visibility with `display: none / block`. Tabs are lazily mounted on first visit, then retained.

```tsx
// Current (simplified)
<LoadFileContent filePath={currentFilePath}>
  {(content) => <MonacoEditor ... />}
</LoadFileContent>

// Proposed
{pane.tabs.map(tab => {
  const isActive = tab.id === pane.activeTabId;
  if (!visitedTabIds.has(tab.id)) return null; // lazy: skip never-visited
  return (
    <div key={tab.id} style={{ display: isActive ? 'block' : 'none' }}
         className="absolute inset-0">
      <LoadFileContent filePath={tab.filePath} paneId={pane.id} isTabActive={isActive}>
        {(content) => <EditorContent ... isTabActive={isActive} />}
      </LoadFileContent>
    </div>
  );
})}
```

Key details:
- Track `visitedTabIds` via a `useRef<Set<string>>` — add `activeTabId` on every change.
- Pass `isTabActive` to child components so they can gate expensive operations (file watchers, cursor events, status bar updates).
- **Closing a tab** removes it from `visitedTabIds` → triggers unmount and cleanup.

> [!IMPORTANT]
> **Memory safety**: With 10+ tabs, hidden Monaco/Tiptap instances add up (~30–50MB each). Phase 3 addresses this with LRU eviction.

---

### Phase 2: Synchronous Content Cache Hit (eliminates loading flash ~100ms saved)

#### [MODIFY] [LoadFileContent.tsx](file:///Users/hudy/ws/depdok/src/features/Editor/LoadFileContent.tsx)

**Current behavior**: On every `filePath` change, resets `isLoading = true`, returns `null` (blank screen), then awaits two async calls:
1. `readFileContent(filePath)` — Tauri IPC to disk
2. `draftService.getDraft(filePath)` — IndexedDB

**New behavior**: Check `liveFilesContentAtom[filePath]` synchronously on mount. If cached, render immediately with `isLoading = false` on the **first frame**. Run disk/draft revalidation in the background (stale-while-revalidate pattern).

```tsx
// Current
const [content, setContent] = useState("");
const [isLoading, setIsLoading] = useState(true);

// Proposed
const cachedContent = liveFilesContent[filePath];
const [content, setContent] = useState(cachedContent ?? "");
const [isLoading, setIsLoading] = useState(cachedContent === undefined);
```

When `cachedContent` exists:
- `isLoading` starts `false` → children render **synchronously** on mount (0ms).
- Background `loadFile()` still runs but only updates content if disk/draft differs from cache (silent revalidation, no blank flash).

When `cachedContent` is missing (first-ever open):
- Falls back to current async loading behavior (acceptable for first open).

---

### Phase 3: Monaco/Tiptap Visibility Relay

#### [MODIFY] [MonacoEditor.tsx](file:///Users/hudy/ws/depdok/src/features/Editor/MonacoEditor.tsx)

When a hidden tab becomes visible, Monaco needs `editor.layout()` to recalculate dimensions (since `display: none` reports zero width/height).

```tsx
// Add isTabActive prop
interface MonacoEditorProps {
  // ... existing props
  isTabActive?: boolean;
}

// Inside component:
useEffect(() => {
  if (isTabActive && editorRef.current) {
    // Force layout recalculation after becoming visible
    requestAnimationFrame(() => {
      editorRef.current?.layout();
    });
  }
}, [isTabActive]);
```

> [!NOTE]
> Monaco's `automaticLayout: true` uses a `ResizeObserver` but `display: none → block` may not trigger it reliably across all browsers. The explicit `layout()` call is a safety net.

#### [MODIFY] [MarkdownPreview.tsx](file:///Users/hudy/ws/depdok/src/features/PreviewMarkdown/MarkdownPreview.tsx)

Tiptap/ProseMirror also needs a viewport recalculation when becoming visible:

```tsx
useEffect(() => {
  if (isTabActive && editor) {
    requestAnimationFrame(() => {
      editor.view.updateState(editor.view.state);
    });
  }
}, [isTabActive, editor]);
```

#### Background Operation Gating

Pass `isTabActive` through the component tree to disable expensive background operations on inactive tabs:

| Component | What to gate |
|-----------|-------------|
| `MonacoEditor` | File watcher (`enableFileWatcher`), cursor status bar events, PlantUML jump |
| `PreviewFileWatcher` | File polling / Tauri event listener |
| `MarkdownPreview` | Drag event listeners, outline minimap updates |

---

### Phase 4: LRU Eviction for Memory Safety

> [!IMPORTANT]
> **User review needed**: What should the max keep-alive count be? Recommended: **8 tabs** kept alive, oldest-accessed evicted. This balances instant switching for recent tabs vs. memory pressure.

Track access order in a `useRef<string[]>` (LRU list). When `visitedTabIds.size > MAX_KEEP_ALIVE`:
1. Find the least-recently-accessed tab ID.
2. Remove it from `visitedTabIds` → React unmounts the hidden container.
3. Next time the user clicks that tab, it lazy-mounts again (cold start, ~300ms once).

This ensures:
- The **8 most-recently-used** tabs switch instantly (0ms).
- Tabs beyond the limit degrade gracefully to current behavior.
- Total memory stays bounded (~400MB max for 8 Monaco instances).

---

## Open Questions

> [!IMPORTANT]
> **LRU eviction limit**: Should the max keep-alive count be **8**, **5**, or configurable in settings? Higher = more memory, faster switching for power users. Lower = safer on 8GB machines.

> [!IMPORTANT]
> **View mode changes**: When a user switches view mode (editor-only → preview-only) on the same tab, should the old view mode's component also be kept alive, or unmounted? Keeping both doubles memory per tab but makes view mode toggling instant too.

---

## Execution Order

| Order | Phase | Files | Expected Impact |
|-------|-------|-------|----------------|
| 1 | Keep-Alive DOM | `EditorPane.tsx` | **~250ms saved** — eliminates remount |
| 2 | Sync Cache Hit | `LoadFileContent.tsx` | **~100ms saved** — eliminates loading flash |
| 3 | Visibility Relay | `MonacoEditor.tsx`, `MarkdownPreview.tsx` | **Correctness** — fixes layout after show |
| 4 | LRU Eviction | `EditorPane.tsx` | **Memory safety** — bounds resource usage |

**After all phases**: Tab switching should be **<16ms** (CSS `display` toggle + `editor.layout()` call).

---

## Verification Plan

### Build Verification
- `pnpm build` — confirm no type errors from new props (`isTabActive`, etc.)

### Manual Verification
1. **Instant switch**: Open 5 tabs (mixed `.md`, `.ts`, `.json`). Click between them rapidly — **zero blank flash, zero loading spinner**.
2. **State preservation**: Edit file A, scroll to line 200, place cursor at col 15. Switch to B, switch back to A — cursor, scroll, and edits **must be preserved**.
3. **Dirty state**: Unsaved changes and dirty indicators must survive tab switches.
4. **View mode**: Switch view mode on a tab, switch away, switch back — correct view mode renders immediately.
5. **Tab close cleanup**: Close a tab → its hidden DOM container is removed, no memory leak.
6. **LRU eviction** (Phase 4): Open 12 tabs. The 9th-oldest tab should cold-start on next click (~300ms), but tabs 1–8 (most recent) switch instantly.
7. **Memory profiling**: Open 8 tabs, check Chrome DevTools Memory tab — should stay under ~500MB total heap.
