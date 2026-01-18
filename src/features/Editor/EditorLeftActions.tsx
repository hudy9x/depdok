import { Link } from "react-router-dom";
import { useAtomValue } from "jotai";
import { ChevronLeft } from "lucide-react";
import { editorStateAtom } from "@/stores/EditorStore";

export function EditorLeftActions() {
  const editorState = useAtomValue(editorStateAtom);

  const getFileName = (path: string | null) => {
    if (!path) return "Untitled";
    return path.split("/").pop() || "Untitled";
  };

  const styleButtons = `w-8 h-[35px] p-2 cursor-pointer hover:opacity-90 hover:bg-background/50 opacity-50 `


  return (
    <div className="flex items-center gap-2 h-[35px]">
      <Link to="/">
        <ChevronLeft className={styleButtons + 'border-x border-border'} />
      </Link>
      <span className="text-xs font-medium">
        {getFileName(editorState.filePath)}
      </span>
      {editorState.isDirty && (
        <div
          className="w-2 h-2 rounded-full bg-orange-500"
          title="Unsaved changes"
        />
      )}
    </div>
  );
}
