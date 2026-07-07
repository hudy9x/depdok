import type { Editor } from "@tiptap/react";
import { ChevronsDownUp } from "lucide-react";

import { useAiEdit } from "@/features/LLMChat/hooks/useAiEdit";

interface ReduceTextProps {
  editor: Editor;
  onStart: () => void;
  onEnd: () => void;
}

export function ReduceText({ editor, onStart, onEnd }: ReduceTextProps) {
  const { runEdit } = useAiEdit(editor);

  const handleClick = async () => {
    onStart();
    await runEdit(
      "Condense, shorten, and reduce the following text to make it concise and brief while preserving all key information.",
    );
    onEnd();
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
      type="button"
    >
      <ChevronsDownUp className="w-3.5 h-3.5 text-muted-foreground" />
      Reduce text
    </button>
  );
}
