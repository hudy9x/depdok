import type { Editor } from "@tiptap/react";
import { BookOpen } from "lucide-react";

import { useAiEdit } from "@/features/LLMChat/hooks/useAiEdit";

interface SimplifyTextProps {
  editor: Editor;
  onStart: () => void;
  onEnd: () => void;
}

export function SimplifyText({ editor, onStart, onEnd }: SimplifyTextProps) {
  const { runEdit } = useAiEdit(editor);

  const handleClick = async () => {
    onStart();
    await runEdit(
      "Simplify the following text to make it easier to read and understand, using simpler vocabulary and clearer sentence structures.",
    );
    onEnd();
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
      type="button"
    >
      <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
      Simplify
    </button>
  );
}
