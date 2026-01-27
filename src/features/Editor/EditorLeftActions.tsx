import { Link } from "react-router-dom";
import { useAtomValue } from "jotai";
import { ChevronLeft } from "lucide-react";
// import { Kbd, KbdGroup } from "@/components/ui/kbd"

import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { editorStateAtom } from "@/stores/EditorStore";
import { isDummyPath, extractFilenameFromDummyPath } from "@/stores/TabStore";
import { FileIcon } from "@/components/FileIcon";

export function EditorLeftActions() {
  const editorState = useAtomValue(editorStateAtom);

  const getFileName = (path: string | null) => {
    if (!path) return "Untitled";

    // Handle UNTITLED:// paths
    if (isDummyPath(path)) {
      return extractFilenameFromDummyPath(path);
    }

    return path.split("/").pop() || "Untitled";
  };

  const handleCopyFilename = async () => {
    if (!editorState.filePath) return;

    // Don't allow copying for UNTITLED:// paths
    if (isDummyPath(editorState.filePath)) {
      toast.info("Save the file first to copy its path");
      return;
    }

    const filename = getFileName(editorState.filePath);
    await writeText(filename);
    toast.success(`Copied: ${filename}`);
  };

  const handleCopyFullPath = async () => {
    if (!editorState.filePath) return;

    // Don't allow copying for UNTITLED:// paths
    if (isDummyPath(editorState.filePath)) {
      toast.info("Save the file first to copy its path");
      return;
    }

    await writeText(editorState.filePath);
    toast.success("Copied full path");
  };

  const styleButtons = `w-8 h-[35px] p-2 cursor-pointer hover:opacity-90 hover:bg-background/100 opacity-90 `


  return (
    <div className="flex items-center gap-2 h-[35px]">
      <Link to="/">
        <ChevronLeft className={styleButtons + 'border-x border-border'} />
      </Link>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="flex items-center gap-2 text-xs font-medium cursor-pointer hover:opacity-70"
              onClick={handleCopyFilename}
              onDoubleClick={handleCopyFullPath}
            >
              <FileIcon filename={getFileName(editorState.filePath)} />
              <span>{getFileName(editorState.filePath)}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-[500px]">
            <p style={{ lineBreak: 'anywhere' }} >{editorState.filePath}</p>
            {!isDummyPath(editorState.filePath || "") && (
              <p className="text-[9px] mt-2 text-primary-foreground/60">
                <code className="text-primary-foreground">Click</code> - copy filename
                <br />
                <code className="text-primary-foreground">Double-click</code> - copy full path
              </p>
            )}
            {/* <p className="text-[9px]">
              <KbdGroup>
                <Kbd>Click</Kbd>
              </KbdGroup>
              : Copy filename
              <br />
              <KbdGroup>
                <Kbd>Double-click</Kbd>
              </KbdGroup>
              : Copy full path
            </p> */}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {editorState.isDirty && (
        <div
          className="w-2 h-2 rounded-full bg-orange-500"
          title="Unsaved changes"
        />
      )}
    </div>
  );
}
