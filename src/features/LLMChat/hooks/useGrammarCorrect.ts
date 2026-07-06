import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { Editor } from "@tiptap/react";

import { grammarCorrectText } from "../api/llm";

/**
 * Hook that handles AI-powered grammar/style correction for TipTap editor selections.
 * Gets selected text → sends to LLM → replaces selection with corrected text.
 */
export function useGrammarCorrect(editor: Editor | null) {
  const [isCorrecting, setIsCorrecting] = useState(false);

  const correct = useCallback(async () => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    if (from === to) {
      toast.warning("Select some text first to correct it.");
      return;
    }

    const text = editor.state.doc.textBetween(from, to, " ");
    if (!text.trim()) return;

    setIsCorrecting(true);
    try {
      const corrected = await grammarCorrectText(text);
      editor.commands.insertContentAt({ from, to }, corrected);
    } catch (err) {
      console.error("Grammar correct failed:", err);
      toast.error(`AI correction failed: ${String(err)}`);
    } finally {
      setIsCorrecting(false);
    }
  }, [editor]);

  return { correct, isCorrecting };
}
