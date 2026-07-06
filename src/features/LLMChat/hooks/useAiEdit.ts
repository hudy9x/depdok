import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { toast } from "sonner";

import { editTextWithAi } from "../api/llm";

/**
 * Shared hook for AI-powered text transformation in TipTap.
 * Fetches a transformation from the LLM, then plays it back with a
 * typewriter animation that mirrors an AI streaming response.
 *
 * @param editor  - The active TipTap editor instance (may be null).
 * @returns `{ runEdit, isRunning }` — call `runEdit(instruction)` to start.
 */
export function useAiEdit(editor: Editor | null) {
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up any running animation on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const runEdit = useCallback(
    async (instruction: string) => {
      if (!editor) return;

      const { from, to } = editor.state.selection;
      if (from === to) {
        toast.warning("Select some text first.");
        return;
      }

      const text = editor.state.doc.textBetween(from, to, " ");
      if (!text.trim()) return;

      setIsRunning(true);

      // Cancel any in-flight animation
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Lock the editor during the operation
      editor.setEditable(false);

      try {
        const result = await editTextWithAi(text, instruction);

        // Typewriter animation — targets 400ms–1200ms based on result length
        await new Promise<void>((resolve, reject) => {
          const tickRate = 20; // ms per tick
          const targetDuration = Math.min(1200, Math.max(400, result.length * 4));
          const totalSteps = Math.ceil(targetDuration / tickRate);
          const charsPerStep = Math.max(1, Math.ceil(result.length / totalSteps));

          let currentLength = 0;
          let previousInsertedLength = to - from;

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

              currentLength = Math.min(result.length, currentLength + charsPerStep);
              const chunk = result.slice(0, currentLength);

              editor.commands.insertContentAt(
                { from, to: from + previousInsertedLength },
                chunk,
              );
              editor.commands.setTextSelection(from + chunk.length);

              previousInsertedLength = chunk.length;

              if (currentLength >= result.length) {
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
        console.error("[useAiEdit] failed:", err);
        toast.error(`AI action failed: ${String(err)}`);
      } finally {
        if (editor && !editor.isDestroyed) {
          editor.setEditable(true);
          editor.commands.focus();
        }
        setIsRunning(false);
      }
    },
    [editor],
  );

  return { runEdit, isRunning };
}
