import { useEffect, useState, ReactNode } from "react";
import { toast } from "sonner";
import { useAtomValue, useSetAtom } from "jotai";
// import { Loader2 } from "lucide-react";
import { draftService } from "@/lib/indexeddb";
import { readFileContent } from "@/lib/fileOperations";
import { activeFileContentAtom, liveFilesContentAtom, liveFilesWriterPaneAtom } from "@/stores/EditorStore";
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
  const setActiveFileContent = useSetAtom(activeFileContentAtom);
  const liveFilesContent = useAtomValue(liveFilesContentAtom);
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

  // Load file on mount or when filePath changes
  useEffect(() => {
    if (!filePath) {
      toast.error("No file path provided");
      setIsLoading(false);
      return;
    }

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
        setActiveFileContent(contentToLoad);
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
        console.error("Error loading file:", error);
        toast.error("Failed to load file");
        // Reset content on error to avoid showing stale data
        setContent("");
        setActiveFileContent(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadFile();
  }, [filePath, onMetadataLoad, setActiveFileContent, markFileAsDirty]);

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
