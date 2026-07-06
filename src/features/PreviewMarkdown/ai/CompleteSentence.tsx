import type { Editor } from "@tiptap/react";
import { PenLine } from "lucide-react";

import { useAiEdit } from "@/features/LLMChat/hooks/useAiEdit";

interface CompleteSentenceProps {
  editor: Editor;
  onStart: () => void;
  onEnd: () => void;
}

export function CompleteSentence({ editor, onStart, onEnd }: CompleteSentenceProps) {
  const { runEdit } = useAiEdit(editor);

  const handleClick = async () => {
    onStart();
    await runEdit(
      "Complete the following sentence or paragraph naturally, continuing the thought or context established in the text.",
    );
    onEnd();
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
      type="button"
    >
      <PenLine className="w-3.5 h-3.5 text-muted-foreground" />
      Complete sentence
    </button>
  );
}
