import type { Editor } from "@tiptap/react";
import { Smile } from "lucide-react";

import { useAiEdit } from "@/features/LLMChat/hooks/useAiEdit";

interface EmojifyTextProps {
  editor: Editor;
  onStart: () => void;
  onEnd: () => void;
}

export function EmojifyText({ editor, onStart, onEnd }: EmojifyTextProps) {
  const { runEdit } = useAiEdit(editor);

  const handleClick = async () => {
    onStart();
    await runEdit(
      "Add appropriate and expressive emojis to enhance the following text, integrating them naturally throughout.",
    );
    onEnd();
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
      type="button"
    >
      <Smile className="w-3.5 h-3.5 text-muted-foreground" />
      Emojify
    </button>
  );
}
