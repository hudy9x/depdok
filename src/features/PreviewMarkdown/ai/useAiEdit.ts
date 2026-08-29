import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

const AI_MODEL = "gemma3:4b";

/**
 * Shared hook for AI-powered text transformation in TipTap.
 * Uses LLM2 (Ollama) backend with fixed model 'gemma3:4b' for generation
 * and plays it back with a typewriter animation.
 *
 * @param editor - The active TipTap editor instance (may be null).
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

      const messageId = `ai-edit-${Date.now()}`;

      try {
        const prompt = `${instruction}\nReturn ONLY the resulting text with no explanation, no quotes, no markdown codeblocks, and no extra commentary:\n\n${text}`;

        const result = await invoke<string>("llm2_send_message", {
          prompt,
          model: AI_MODEL,
          contentModel: AI_MODEL,
          content_model: AI_MODEL,
          messageId,
          message_id: messageId,
          allowedTools: [],
          allowed_tools: [],
          think: false,
          systemPromptAddendum:
            "You are a concise text transformation assistant. Output ONLY the requested transformed text without conversational filler, explanations, or code blocks.",
          system_prompt_addendum:
            "You are a concise text transformation assistant. Output ONLY the requested transformed text without conversational filler, explanations, or code blocks.",
        });

        if (!result || !result.trim()) {
          toast.error("AI returned an empty response. Please try again.");
          return;
        }

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
      } catch (err: unknown) {
        console.error("[useAiEdit] failed:", err);
        const errMsg = typeof err === "string" ? err : (err as Error)?.message || String(err);

        if (
          errMsg.includes("Failed to connect") ||
          errMsg.includes("Cannot connect") ||
          errMsg.includes("connection refused") ||
          errMsg.includes("error trying to connect") ||
          errMsg.includes("os error 61")
        ) {
          toast.error("Ollama is not running or unreachable", {
            description: `Please make sure Ollama is running on port 11434 with model '${AI_MODEL}'.`,
          });
        } else if (errMsg.toLowerCase().includes("not found")) {
          toast.error(`Model '${AI_MODEL}' not found in Ollama`, {
            description: `Please run 'ollama pull ${AI_MODEL}' in your terminal.`,
          });
        } else {
          toast.error("AI action failed", {
            description: errMsg,
          });
        }
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
