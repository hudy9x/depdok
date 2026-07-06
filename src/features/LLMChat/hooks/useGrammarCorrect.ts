import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { toast } from "sonner";

import { grammarCorrectText } from "../api/llm";

/**
 * Hook that handles AI-powered grammar/style correction for TipTap editor selections.
 * Gets selected text → sends to LLM → replaces selection with corrected text.
 */
export function useGrammarCorrect(editor: Editor | null) {
  const [isCorrecting, setIsCorrecting] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up any running intervals on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

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

    // Clear any existing animation before starting a new one
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Set editor to non-editable during animation to avoid user modification issues
    editor.setEditable(false);

    try {
      const corrected = await grammarCorrectText(text);

      // Perform a typewriter-style animation to simulate an AI response stream
      await new Promise<void>((resolve, reject) => {
        const tickRate = 20; // tick every 20ms
        // Ensure animation finishes within a satisfying duration (between 400ms and 1200ms)
        const targetDuration = Math.min(1200, Math.max(400, corrected.length * 4));
        const totalSteps = Math.ceil(targetDuration / tickRate);
        const charsPerStep = Math.max(1, Math.ceil(corrected.length / totalSteps));

        let currentLength = 0;
        let previousInsertedLength = to - from; // Initially, we replace the whole selected range

        intervalRef.current = setInterval(() => {
          try {
            if (!editor || editor.isDestroyed) {
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              resolve();
              return;
            }

            currentLength = Math.min(corrected.length, currentLength + charsPerStep);
            const chunk = corrected.slice(0, currentLength);

            // Replace the previously inserted segment at the starting position
            editor.commands.insertContentAt(
              { from, to: from + previousInsertedLength },
              chunk
            );

            // Update the selection/cursor to be at the end of the currently typed chunk
            editor.commands.setTextSelection(from + chunk.length);

            previousInsertedLength = chunk.length;

            if (currentLength >= corrected.length) {
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              resolve();
            }
          } catch (e) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            reject(e);
          }
        }, tickRate);
      });
    } catch (err) {
      console.error("Grammar correct failed:", err);
      toast.error(`AI correction failed: ${String(err)}`);
    } finally {
      if (editor && !editor.isDestroyed) {
        editor.setEditable(true);
        editor.commands.focus();
      }
      setIsCorrecting(false);
    }
  }, [editor]);

  return { correct, isCorrecting };
}

