import { useEffect, useState, ReactNode } from "react";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";
import { draftService } from "@/lib/indexeddb";
import { RecoveryDialog } from "@/components/RecoveryDialog";

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
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [draftContent, setDraftContent] = useState("");
  const [fileContent, setFileContent] = useState("");

  // Load file on mount or when filePath changes
  useEffect(() => {
    if (!filePath) {
      toast.error("No file path provided");
      return;
    }

    const loadFile = async () => {
      try {
        // 1. Load file from disk
        const loadedFileContent = await readTextFile(filePath);
        const extension = filePath.split(".").pop()?.toLowerCase() || "";

        // 2. Check for draft in IndexedDB
        const draft = await draftService.getDraft(filePath);

        console.log("fileContent", loadedFileContent, draft);

        if (draft && draft.content !== loadedFileContent) {
          // Draft exists and differs from file
          setDraftContent(draft.content);
          setFileContent(loadedFileContent);
          setShowRecoveryDialog(true);
        } else {
          // No draft or draft matches file
          setContent(loadedFileContent);
        }

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
      }
    };

    loadFile();
  }, [filePath, onMetadataLoad]);

  const handleRecoveryChoice = (useDraft: boolean) => {
    const selectedContent = useDraft ? draftContent : fileContent;
    setContent(selectedContent);
    setShowRecoveryDialog(false);
  };

  return (
    <>
      {showRecoveryDialog && (
        <RecoveryDialog
          onUseDraft={() => handleRecoveryChoice(true)}
          onUseFile={() => handleRecoveryChoice(false)}
        />
      )}
      {children(content)}
    </>
  );
}
