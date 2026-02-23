import { useEffect, useState, ReactNode } from "react";
import { toast } from "sonner";
// import { Loader2 } from "lucide-react";
import { draftService } from "@/lib/indexeddb";
import { readFileContent } from "@/lib/fileOperations";

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

        if (!isUntitled && !isImage) {
          // 1. Load real file from disk
          loadedFileContent = await readFileContent(filePath);
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

        setContent(contentToLoad);

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
      } finally {
        setIsLoading(false);
      }
    };

    loadFile();
  }, [filePath, onMetadataLoad]);

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
