import type { Editor } from "@tiptap/react";
import { ChevronsDownUp } from "lucide-react";

import { useAiEdit } from "@/features/LLMChat/hooks/useAiEdit";

interface ExtendTextProps {
  editor: Editor;
  onStart: () => void;
  onEnd: () => void;
}

export function ExtendText({ editor, onStart, onEnd }: ExtendTextProps) {
  const { runEdit } = useAiEdit(editor);

  const handleClick = async () => {
    onStart();
    await runEdit(
      "Elaborate, expand, and extend the following text to make it more detailed and comprehensive while keeping the original meaning.",
    );
    onEnd();
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
      type="button"
    >
      <ChevronsDownUp className="w-3.5 h-3.5 text-muted-foreground rotate-180" />
      Extend text
    </button>
  );
}
