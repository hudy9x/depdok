# Native PlantUML Preview — Implementation Plan

## Background: How the Playground Renders Without Java

The [playground](https://plantuml.github.io/plantuml/js-plantuml/index.html) and [plantuml.js](https://github.com/plantuml/plantuml.js) use **two different but related approaches**. Both are fully Java-free and server-free.

### Approach A — `js-plantuml` (TeaVM, pure JS)
This is what the playground at `plantuml.github.io/plantuml/js-plantuml/index.html` uses.

```
plantuml.js  ← the entire PlantUML Java engine cross-compiled to JS via TeaVM
              + viz-global.js for Graphviz layout (WASM under the hood)

import { render } from "./plantuml.js";
render(lines, "out", { dark: false });
// → writes SVG directly into DOM element with id="out"
```

- **Engine**: PlantUML's Java codebase compiled to JavaScript with [TeaVM](https://teavm.org/), a Java bytecode → JS transpiler.
- **Graphviz**: Class/component diagrams that need layout use `viz-global.js`, a WASM build of Graphviz embedded inside `plantuml.js`.
- **Size**: The minified `plantuml.js` is ~1.5 MB. No network requests needed after load.
- **API**: `render(lines: string[], targetElementId: string, options: { dark?: boolean })` — dead simple.
- **npm**: Published as `@plantuml/plantuml-js` — can be installed with pnpm.

### Approach B — `plantuml-wasm` (CheerpJ, WASM JVM)
Used by the demo at `plantuml.github.io/plantuml.js/`. This runs the actual `.jar` file inside a **CheerpJ** WebAssembly JVM in the browser.

```html
<script src="https://cjrtnc.leaningtech.com/2.3/loader.js"></script>
<script src="plantuml-wasm/plantuml.js"></script>
```

- **Engine**: The real `plantuml-core.jar` (4.4 MB) executing inside CheerpJ's WASM JVM.
- **API**: Async Java method calls through CheerpJ bridge: `cheerpjInit()` → `cheerpjRunMain("com.plantuml.wasm.RunInit", ...)` → `com.plantuml.wasm.Utils.convertSvg(...)`.
- **Size**: `plantuml-core.jar.js` is ~17 MB (!), plus the CheerpJ loader from CDN.
- **Tauri concern**: CheerpJ loads a loader from `cjrtnc.leaningtech.com` — requires internet. **Not suitable for offline use.**

---

## Current State in Depdok

The codebase already has partial PlantUML support:

| Component | Description |
|-----------|-------------|
| `PreviewPanel.tsx` | Routes `.puml`/`.pu` files to `PlantUMLBrowserPreview` |
| `PlantUMLBrowserPreview.tsx` | Uses `beautiful-plantuml` library — **sequence diagram only**, no class/activity/component diagrams |
| `index.tsx` (PlantUMLPreview) | Uses a **remote PlantUML server** (`img.plantuml.biz` or custom) to fetch SVG — commented out |
| `PlantUmlServerSetting.tsx` | UI for configuring custom PlantUML server URL |
| `plantuml-parser.ts`, `store.ts` | Source-line click/jump parsing helpers |

### Current Pain Points
- `PlantUMLBrowserPreview` only handles **sequence diagrams** via `beautiful-plantuml`; class, activity, component, mindmap, etc. are not rendered.
- `PlantUMLPreview` (server approach) requires internet and a running server, which breaks offline usage.

---

## Goal

Replace the current sequence-diagram-only `PlantUMLBrowserPreview` with a **fully native, offline-capable renderer** that supports all PlantUML diagram types using `@plantuml/plantuml-js` (Approach A).

---

## Proposed Changes

### 1. Install `@plantuml/plantuml-js`

```bash
pnpm add @plantuml/plantuml-js
```

This package ships the TeaVM-compiled JS + WASM bundle. No server needed.

> [!IMPORTANT]
> The package ships `viz-global.js` and possibly `.wasm` files for Graphviz. We need to verify Vite can bundle them and serve the WASM file correctly (may need `vite-plugin-wasm` or `?url` import).

---

### 2. Create `PlantUMLNativePreview.tsx`

A new React component in `src/features/PreviewPlantUML/` that:

1. Lazy-initializes the `plantuml-js` engine (one-time, on first use).
2. On content change (debounced), calls `render(lines, containerId, { dark })` to inject SVG into a container div.
3. Displays a loading spinner while rendering.
4. Handles render errors gracefully.
5. Wraps the output in `ZoomPanContainer` (consistent with existing UI).

```tsx
// src/features/PreviewPlantUML/PlantUMLNativePreview.tsx
import { useEffect, useRef } from "react";
import { useDebounce } from "use-debounce";
import { useTheme } from "next-themes";
import { ZoomPanContainer } from "@/components/ZoomPanContainer";

// lazy-loaded — the bundle is heavy (~1.5 MB)
const renderDiagram = async (lines: string[], id: string, dark: boolean) => {
  const { render } = await import("@plantuml/plantuml-js");
  render(lines, id, { dark });
};
```

#### [NEW] `PlantUMLNativePreview.tsx`
- Props: `{ content: string; onContentChange?: (c: string) => void }`
- Uses a stable `containerId` (unique `useId` or fixed string)
- Debounce: 600ms (similar to Mermaid)
- Dark mode: reads `resolvedTheme` from `next-themes`

---

### 3. Register and Support `.npuml` and `.nplantuml` Extensions

To support the native PlantUML preview mode using both editor and preview views, we need to register the `.npuml` (Native PlantUML) and `.nplantuml` extensions across the workspace.

#### 3a. Register Extensions in `fileSupport.ts`
Add `'npuml'` and `'nplantuml'` to the `CUSTOM_PREVIEW_EXTENSIONS` list. This ensures they are marked as editable text files and support customized preview views.

```diff
// src/lib/fileSupport.ts
  export const CUSTOM_PREVIEW_EXTENSIONS = [
-   'md', 'txt', 'todo', 'mmd', 'mermaid', 'puml', 'pu', 'plantuml', 'logger', 'format', 'excalidraw'
+   'md', 'txt', 'todo', 'mmd', 'mermaid', 'puml', 'pu', 'plantuml', 'logger', 'format', 'excalidraw', 'npuml', 'nplantuml'
  ];
```

#### [MODIFY] [fileSupport.ts](file:///Users/hudy/ws/depdok/src/lib/fileSupport.ts)

---

#### 3b. Map Monaco Syntax Language in `getMonacoLanguage.ts`
Ensure the Monaco editor syntax highlighting maps `.npuml` and `.nplantuml` extensions to the `"plantuml"` language definition.

```diff
// src/lib/utils/getMonacoLanguage.ts
  // PlantUML files
-   if (["puml", "pu"].includes(ext)) {
+   if (["puml", "pu", "npuml", "nplantuml"].includes(ext)) {
      return "plantuml";
    }
```

#### [MODIFY] [getMonacoLanguage.ts](file:///Users/hudy/ws/depdok/src/lib/utils/getMonacoLanguage.ts)

---

#### 3c. Add Icons in `FileIcon.tsx`
Map the file icons for `.npuml` and `.nplantuml` to render the existing `PlantumlIcon` inside tab bars and file lists.

```diff
// src/components/FileIcon.tsx
-   if (filename.endsWith('.plantuml') || filename.endsWith('.puml') || filename.endsWith('.pu')) return <PlantumlIcon ... />;
+   if (filename.endsWith('.plantuml') || filename.endsWith('.puml') || filename.endsWith('.pu') || filename.endsWith('.npuml') || filename.endsWith('.nplantuml')) return <PlantumlIcon ... />;
```

#### [MODIFY] [FileIcon.tsx](file:///Users/hudy/ws/depdok/src/components/FileIcon.tsx)

---

#### 3d. Update New File Creation Dialog in `NewTabDialog.tsx`
Include the new extensions in the `SUPPORTED_EXTENSIONS` list for the new file dialog.

```diff
// src/features/EditorTabs/NewTabDialog.tsx
- const SUPPORTED_EXTENSIONS = ['md', 'mmd', 'todo', 'plantuml'];
+ const SUPPORTED_EXTENSIONS = ['md', 'mmd', 'todo', 'plantuml', 'npuml', 'nplantuml'];
```

#### [MODIFY] [NewTabDialog.tsx](file:///Users/hudy/ws/depdok/src/features/EditorTabs/NewTabDialog.tsx)

---

#### 3e. Update Router in `PreviewPanel.tsx`
Map `.npuml` and `.nplantuml` file extensions to render using the new `PlantUMLNativePreview` component. The old `.puml` / `.pu` extensions will continue using the sequence-diagram-only `PlantUMLBrowserPreview` (or we can migrate them altogether once verified).

```diff
// src/features/Preview/PreviewPanel.tsx
- import { PlantUMLBrowserPreview } from "../PreviewPlantUML/PlantUMLBrowserPreview";
+ import { PlantUMLBrowserPreview } from "../PreviewPlantUML/PlantUMLBrowserPreview";
+ import { PlantUMLNativePreview } from "../PreviewPlantUML/PlantUMLNativePreview";

  if (["puml", "pu"].includes(fileExtension)) {
    return <PlantUMLBrowserPreview content={content} onContentChange={onContentChange} />;
  }
+ 
+ if (["npuml", "nplantuml"].includes(fileExtension)) {
+   return <PlantUMLNativePreview content={content} onContentChange={onContentChange} />;
+ }
```

#### [MODIFY] [PreviewPanel.tsx](file:///Users/hudy/ws/depdok/src/features/Preview/PreviewPanel.tsx)

---

#### 3f. Support View Modes in `EditorPane.tsx`
In `EditorPane.tsx`, layout rendering is handled generically by checking `pane.viewMode`. Since `.npuml` and `.nplantuml` files are not listed in `EXTENSION_SUPPORTED_MODES` within `EditorViewMode/index.tsx`, they automatically default to supporting all three view modes:
- **`editor-only`**: Renders `MonacoEditor`
- **`side-by-side`**: Renders `SideBySide` (containing `MonacoEditor` and `PreviewPanel`)
- **`preview-only`**: Renders `PreviewPanel` inside a file watcher

This enables full interactive split/editor/preview support automatically.

#### [MODIFY] [EditorPane.tsx](file:///Users/hudy/ws/depdok/src/features/EditorWorkspace/EditorPane.tsx)


---

### 4. Handle WASM/Vite Build Configuration

The `@plantuml/plantuml-js` package contains a Graphviz WASM file. Vite needs to be told how to handle it.

#### [MODIFY] `vite.config.ts` (if it exists)

Options:
- **Option A (preferred)**: Add `vite-plugin-wasm` + `vite-plugin-top-level-await`
  ```bash
  pnpm add -D vite-plugin-wasm vite-plugin-top-level-await
  ```
- **Option B**: Copy the `.wasm` file to `public/` and configure the import path manually

We'll determine the right approach after installing and checking what the package actually includes.

---

### 5. Also render PlantUML blocks inside Markdown

The existing `PlantUMLNodeView.tsx` currently uses a remote server to render `plantuml` fenced code blocks in markdown. This should also be updated to use the native renderer.

#### [MODIFY] `PlantUMLNodeView.tsx`
- Replace remote server fetch with a call to `render()` from `@plantuml/plantuml-js`

---

### 6. Settings Cleanup

The `PlantUmlServerSetting.tsx` was relevant for the server approach. With native rendering, the server URL setting becomes optional (fallback only).

> [!NOTE]
> We can keep the server setting as a fallback option for power users, but update its description to say "Native browser rendering is used by default". No code deletion needed.

---

## Open Questions

> [!IMPORTANT]
> **Package verification**: Before implementing, we need to confirm `@plantuml/plantuml-js` is the correct npm package name and check its exports. The GitHub repo uses it as a direct JS file import — the npm package may have a different API surface.

> [!NOTE]
> **Resolved — Interactive Editing vs. Side-by-Side**:
> We will **not** implement interactive editing (clicking elements to edit, adding participants from popovers, or jumping to line from clicking arrows/participants) for `.npuml` and `.nplantuml` files. Trying to sync SVG clicks with document structures via regex is error-prone and causes code structure issues.
> Instead:
> - `.npuml`/`.nplantuml` will use the standard **side-by-side layout** (live Monaco editor on the left + read-only native SVG on the right).
> - `.puml`/`.pu` files can continue to use `beautiful-plantuml`'s interactive sequence diagram view if they are sequence diagrams.

> [!NOTE]
> **Performance**: First render will trigger lazy loading of the ~1.5 MB bundle. Should we preload it in the background?


---

## Verification Plan

### Automated Tests
- None currently in repo. Recommend manual verification.

### Manual Verification
1. Open a `.puml` file with a sequence diagram → should render.
2. Open a `.puml` file with a class diagram → should render (was broken before).
3. Open a `.puml` file with an activity or component diagram → should render.
4. Open a Markdown file with a ````plantuml` block → should render inline.
5. Toggle dark mode → diagram should re-render in dark palette.
6. Disconnect internet → everything should still work (offline).
7. Build `pnpm build` → no WASM import errors.
