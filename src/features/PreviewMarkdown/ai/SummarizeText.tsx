import type { Editor } from "@tiptap/react";
import { ListCollapse } from "lucide-react";

import { useAiEdit } from "@/features/LLMChat/hooks/useAiEdit";

interface SummarizeTextProps {
  editor: Editor;
  onStart: () => void;
  onEnd: () => void;
}

export function SummarizeText({ editor, onStart, onEnd }: SummarizeTextProps) {
  const { runEdit } = useAiEdit(editor);

  const handleClick = async () => {
    onStart();
    await runEdit(
      "Create a concise summary of the main points in the following text. Keep it brief and clear.",
    );
    onEnd();
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
      type="button"
    >
      <ListCollapse className="w-3.5 h-3.5 text-muted-foreground" />
      Summarize
    </button>
  );
}
