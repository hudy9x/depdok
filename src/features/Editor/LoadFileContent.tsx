import { useEffect, useState, ReactNode } from "react";
import { toast } from "sonner";
import { useSetAtom, useStore } from "jotai";
// import { Loader2 } from "lucide-react";
import { draftService } from "@/lib/indexeddb";
import { readFileContent } from "@/lib/fileOperations";
import { activeFileContentAtom } from "@/stores/EditorStore";
import { tabsAtom } from "@/stores/TabStore";

interface LoadFileContentProps {
  filePath: string;
  onMetadataLoad?: (metadata: {
    path: string;
    extension: string;
    isDirty: boolean;
  }) => void;
  children: (content: string) => ReactNode;
}

export function LoadFileContent({
  filePath,
  onMetadataLoad,
  children,
}: LoadFileContentProps) {
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const setActiveFileContent = useSetAtom(activeFileContentAtom);
  const store = useStore();

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

        if (!isImage && draft) {
          if (isUntitled || draft.content !== loadedFileContent) {
            contentToLoad = draft.content;
          }
        }

        // If reading failed and no draft exists, only throw (causing a toast)
        // if the file is NOT marked as deleted externally.
        if (readFailed && !draft) {
          const tabs = store.get(tabsAtom);
          const currentTab = tabs.find(t => t.filePath === filePath);
          const isFileDeleted = currentTab?.isDeleted;
          if (!isFileDeleted) {
            throw new Error("File could not be read and no draft exists");
          }
        }

        setContent(contentToLoad);
        setActiveFileContent(contentToLoad);

        // Update metadata
        if (onMetadataLoad) {
          onMetadataLoad({
            path: filePath,
            extension,
            isDirty: !!draft,
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
  }, [filePath, onMetadataLoad, setActiveFileContent, store]);

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
