import { useEffect, useState, ReactNode } from "react";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { draftService } from "@/lib/indexeddb";

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
        // 1. Load file from disk
        const loadedFileContent = await readTextFile(filePath);
        const extension = filePath.split(".").pop()?.toLowerCase() || "";

        // 2. Check for draft in IndexedDB
        const draft = await draftService.getDraft(filePath);

        // If draft exists and differs from file, use draft content
        // Otherwise, use file content
        const contentToLoad = draft && draft.content !== loadedFileContent
          ? draft.content
          : loadedFileContent;

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
      } finally {
        setIsLoading(false);
      }
    };

    loadFile();
  }, [filePath, onMetadataLoad]);

  return (
    <>
      {isLoading ? (
        <div className="fixed top-[35px] h-[calc(100vh-35px)] left-0 w-full flex items-center justify-center bg-background">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading file...</p>
          </div>
        </div>
      ) : (
        children(content)
      )}
    </>
  );
}
