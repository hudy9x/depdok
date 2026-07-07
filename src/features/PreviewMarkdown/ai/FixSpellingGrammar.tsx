import type { Editor } from "@tiptap/react";
import { SpellCheck } from "lucide-react";

import { useAiEdit } from "@/features/LLMChat/hooks/useAiEdit";

interface FixSpellingGrammarProps {
  editor: Editor;
  onStart: () => void;
  onEnd: () => void;
}

export function FixSpellingGrammar({ editor, onStart, onEnd }: FixSpellingGrammarProps) {
  const { runEdit } = useAiEdit(editor);

  const handleClick = async () => {
    onStart();
    await runEdit(
      "Fix the spelling, grammar, and style of this text without changing its meaning or structure.",
    );
    onEnd();
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
      type="button"
    >
      <SpellCheck className="w-3.5 h-3.5 text-muted-foreground" />
      Fix spelling &amp; grammar
    </button>
  );
}
