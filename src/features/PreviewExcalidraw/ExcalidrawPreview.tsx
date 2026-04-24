import "@excalidraw/excalidraw/index.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useSetAtom } from "jotai";
import { isSavingAtom } from "@/stores/FileWatchStore";
import { FolderPlus } from "lucide-react";
import { installCustomLibrary, loadAllInstalledLibraries } from "./libraryManager";
// Lazy-load Excalidraw only on the client (it's a large package)
const loadExcalidraw = () => import("@excalidraw/excalidraw");

interface ExcalidrawPreviewProps {
  content: string;
  filePath?: string;
  onContentChange?: (content: string) => void;
}

interface ExcalidrawModule {
  Excalidraw: React.ComponentType<ExcalidrawComponentProps>;
  serializeAsJSON: (
    elements: ExcalidrawElement[],
    appState: ExcalidrawAppState,
    files: Record<string, unknown>,
    type: "local" | "database"
  ) => string;
}

interface ExcalidrawComponentProps {
  initialData?: {
    elements?: ExcalidrawElement[];
    appState?: Partial<ExcalidrawAppState>;
    files?: Record<string, unknown>;
  };
  theme?: "light" | "dark";
  zenModeEnabled?: boolean;
  gridModeEnabled?: boolean;
  onChange?: (
    elements: ExcalidrawElement[],
    appState: ExcalidrawAppState,
    files: Record<string, unknown>
  ) => void;
  UIOptions?: {
    canvasActions?: {
      changeViewBackgroundColor?: boolean;
      clearCanvas?: boolean;
      export?: boolean | object;
      loadScene?: boolean;
      saveToActiveFile?: boolean;
      saveAsImage?: boolean;
      theme?: boolean;
    };
  };
  excalidrawAPI?: (api: any) => void;
  renderTopRightUI?: (isMobile: boolean, appState: ExcalidrawAppState) => React.ReactNode;
}

interface ExcalidrawElement {
  id: string;
  type: string;
  [key: string]: unknown;
}

interface ExcalidrawAppState {
  viewBackgroundColor: string;
  [key: string]: unknown;
}

interface ExcalidrawScene {
  type?: string;
  version?: number;
  elements?: ExcalidrawElement[];
  appState?: Partial<ExcalidrawAppState>;
  files?: Record<string, unknown>;
}

const EMPTY_SCENE: ExcalidrawScene = {
  type: "excalidraw",
  version: 2,
  elements: [],
  appState: { viewBackgroundColor: "#ffffff" },
  files: {},
};

const parseScene = (content: string): ExcalidrawScene => {
  if (!content.trim()) return EMPTY_SCENE;
  try {
    const parsed = JSON.parse(content);
    if (parsed && (parsed.type === "excalidraw" || Array.isArray(parsed.elements))) {
      return parsed as ExcalidrawScene;
    }
  } catch {
    // fall through to empty scene on parse error
  }
  return EMPTY_SCENE;
};

export function ExcalidrawPreview({ content, filePath, onContentChange }: ExcalidrawPreviewProps) {
  const { resolvedTheme } = useTheme();
  const [ExcalidrawModule, setExcalidrawModule] = useState<ExcalidrawModule | null>(null);
  const [loadError, setLoadError] = useState(false);
  const setIsSaving = useSetAtom(isSavingAtom);
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

  // Skip the very first onChange fired by Excalidraw on mount
  const isMountedRef = useRef(false);
  // Debounce timer ref
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track last serialized content to skip onChange calls with no real changes
  const lastSerializedRef = useRef<string>(content);
  // Wrapper div ref for Cmd+S capture-phase intercept
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadExcalidraw()
      .then((mod) => setExcalidrawModule(mod as unknown as ExcalidrawModule))
      .catch((err) => {
        console.error("[ExcalidrawPreview] Failed to load Excalidraw:", err);
        setLoadError(true);
      });
  }, []);

  // Load custom libraries on API mount
  useEffect(() => {
    if (!excalidrawAPI) return;
    loadAllInstalledLibraries().then((libraryItems) => {
      console.log("[ExcalidrawPreview] loadAllInstalledLibraries returned:", libraryItems?.length);
      if (libraryItems && libraryItems.length > 0) {
        excalidrawAPI.updateLibrary({ libraryItems, merge: true });
        console.log("[ExcalidrawPreview] Updated API with libraries");
      }
    });
  }, [excalidrawAPI]);

   // Intercept Cmd+S / Ctrl+S in capture phase so Excalidraw never sees it.
   // EditorSaveHandler listens on window in capture phase, which fires BEFORE
   // this div's capture listener (capture goes top-down: window → div), so
   // the app-level save handler still runs.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        console.log("[ExcalidrawPreview] 🛑 Capture-phase Cmd+S intercepted — stopping Excalidraw from seeing it");
        // Stop Excalidraw from opening its own save dialog.
        // EditorSaveHandler on window(capture) already fired before this.
        e.stopImmediatePropagation();
      }
    };

    el.addEventListener("keydown", handleKeyDown, true /* capture */);
    return () => el.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  const scene = useMemo(() => parseScene(content), [content]);

  const excalidrawTheme = resolvedTheme === "dark" ? "dark" : "light";

  const handleChange = useCallback(
    (
      elements: ExcalidrawElement[],
      appState: ExcalidrawAppState,
      files: Record<string, unknown>
    ) => {
      // Skip the initial onChange Excalidraw fires synchronously on mount
      if (!isMountedRef.current) {
        isMountedRef.current = true;
        console.log("[ExcalidrawPreview] ⏭️ Skipping initial mount onChange");
        return;
      }

      if (!onContentChange || !ExcalidrawModule) return;

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (!ExcalidrawModule) return;
        const serialized = ExcalidrawModule.serializeAsJSON(elements, appState, files, "local");

        // Skip if the content hasn't actually changed — Excalidraw fires onChange
        // for internal appState changes (toolbar, cursor) that don't affect the scene.
        if (serialized === lastSerializedRef.current) {
          console.log("[ExcalidrawPreview] ⏭️ onChange — content unchanged, skipping save");
          return;
        }
        lastSerializedRef.current = serialized;

        console.log("[ExcalidrawPreview] 💾 onChange debounce fired — setting isSaving =", filePath ?? null, "then calling onContentChange");
        // Signal file watcher to ignore the next file-change event we cause
        setIsSaving(filePath ?? null);
        onContentChange(serialized);
        // Clear the flag after enough time for the file watcher event to arrive
        setTimeout(() => {
          console.log("[ExcalidrawPreview] 🔓 Clearing isSaving");
          setIsSaving(null);
        }, 1500);
      }, 600);
    },
    [onContentChange, ExcalidrawModule, setIsSaving]
  );

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        Failed to load Excalidraw.
      </div>
    );
  }

  if (!ExcalidrawModule) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
        Loading Excalidraw…
      </div>
    );
  }

  const { Excalidraw } = ExcalidrawModule;

  return (
    <div ref={wrapperRef} className="relative w-full h-full">
      <div className="absolute inset-0">
        <Excalidraw
          excalidrawAPI={setExcalidrawAPI}
          renderTopRightUI={() => (
            <button
              className="flex items-center gap-2 px-3 py-1 bg-accent hover:bg-accent/80  text-foreground rounded-md text-sm font-medium transition-colors border border-border shadow-xs h-9 cursor-pointer"
              onClick={async (e) => {
                e.preventDefault();
                const items = await installCustomLibrary();
                if (items && items.length > 0 && excalidrawAPI) {
                  excalidrawAPI.updateLibrary({ libraryItems: items, merge: true, openLibraryMenu: true });
                }
              }}
            >
              <FolderPlus className="w-4 h-4" />
              Import Library
            </button>
          )}
          initialData={{
            elements: scene.elements ?? [],
            appState: {
              ...scene.appState,
              zenModeEnabled: false,
            },
            files: scene.files ?? {},
          }}
          theme={excalidrawTheme}
          zenModeEnabled={false}
          onChange={onContentChange ? handleChange : undefined}
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: true,
              clearCanvas: false,
              export: false,
              loadScene: false,
              saveToActiveFile: false,
              saveAsImage: true,
              theme: false,
            },
          }}
        />
      </div>
    </div>
  );
}
