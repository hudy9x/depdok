import { useEffect, useState, ReactNode } from "react";
import { toast } from "sonner";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
// import { Loader2 } from "lucide-react";
import { draftService } from "@/lib/indexeddb";
import { readFileContent } from "@/lib/fileOperations";
import { liveFilesContentAtom, liveFilesWriterPaneAtom } from "@/stores/EditorStore";
import { markFileAsDirtyAtom } from "@/stores/DirtyStore";

interface LoadFileContentProps {
  filePath: string;
  isDeleted?: boolean;
  /** The pane this component lives in. Used to filter out self-originated atom updates. */
  paneId?: string;
  onMetadataLoad?: (metadata: {
    path: string;
    extension: string;
  }) => void;
  children: (content: string) => ReactNode;
}

export function LoadFileContent({
  filePath,
  isDeleted,
  paneId,
  onMetadataLoad,
  children,
}: LoadFileContentProps) {
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [liveFilesContent, setLiveFilesContent] = useAtom(liveFilesContentAtom);
  const liveFilesWriterPane = useAtomValue(liveFilesWriterPaneAtom);
  const markFileAsDirty = useSetAtom(markFileAsDirtyAtom);

  useEffect(() => {
    if (isLoading) return;

    const liveValue = liveFilesContent[filePath];
    // Skip if this atom update was written by our own pane — that is just the
    // user's keystrokes reflecting back and would cause a stale-intermediate reset.
    const writerPane = liveFilesWriterPane[filePath];
    if (paneId && writerPane === paneId) return;

    if (liveValue !== undefined && liveValue !== content) {
      setContent(liveValue);
    }
  }, [liveFilesContent, liveFilesWriterPane, filePath, isLoading, paneId]);

  // Load file on mount or when filePath changes.
  // A `cancelled` flag ensures that if `filePath` changes while an async load
  // is in-flight, the stale load bails out before touching any state.
  // Without this guard two concurrent loadFile calls can race: the stale one
  // can overwrite correct content with wrong/empty content, or call
  // setActiveFileContent(null) which (because it resolves via activeTabAtom)
  // deletes the *new* file's live-content entry — causing the empty-content bug.
  useEffect(() => {
    if (!filePath) {
      toast.error("No file path provided");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const loadFile = async () => {
      setIsLoading(true);
      try {
        let loadedFileContent = "";
        const isUntitled = filePath.startsWith("UNTITLED://");
        const extension = filePath.split(".").pop()?.toLowerCase() || "";

        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp'];
        const isImage = imageExtensions.includes(extension);

        let readFailed = false;

        if (!isUntitled && !isImage) {
          // 1. Load real file from disk
          try {
            loadedFileContent = await readFileContent(filePath);
          } catch (err) {
            readFailed = true;
            console.log("[LoadFileContent] Could not read file from disk (might be deleted):", err);
          }
        }

        // 2. Check for draft in IndexedDB
        const draft = await draftService.getDraft(filePath);

        // Bail out if filePath changed while we were awaiting — prevents a stale
        // load from overwriting state that the current load already set correctly.
        if (cancelled) return;

        // If draft exists and differs from file, use draft content
        // For untitled files, ALWAYS use draft content (or empty string if no draft)
        let contentToLoad = loadedFileContent;
        let shouldMarkDirty = filePath.startsWith("UNTITLED://");

        if (!isImage && draft) {
          if (isUntitled || draft.content !== loadedFileContent) {
            contentToLoad = draft.content;
            shouldMarkDirty = true;
          }
        }

        // If reading failed and no draft exists, only throw (causing a toast)
        // if the file is NOT marked as deleted externally.
        if (readFailed && !draft) {
          if (!isDeleted) {
            throw new Error("File could not be read and no draft exists");
          }
        }

        setContent(contentToLoad);
        setLiveFilesContent((prev) => ({ ...prev, [filePath]: contentToLoad }));
        if (shouldMarkDirty) {
          markFileAsDirty(filePath);
        }

        // Update metadata
        if (onMetadataLoad) {
          onMetadataLoad({
            path: filePath,
            extension,
          });
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Error loading file:", error);
        toast.error("Failed to load file");
        // Reset content on error to avoid showing stale data
        setContent("");
        setLiveFilesContent((prev) => { const { [filePath]: _, ...rest } = prev; return rest; });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadFile();

    return () => {
      cancelled = true;
    };
  }, [filePath, onMetadataLoad, setLiveFilesContent, markFileAsDirty]);

  return (
    <>
      {isLoading ? (
        null
      ) : (
        children(content)
      )}
    </>
  );
}
