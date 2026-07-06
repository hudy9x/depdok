import { useEffect, useRef } from "react";
import { useSetAtom, useAtomValue } from "jotai";

import {
  onLlmToken,
  onLlmDone,
  onLlmError,
  onLlmToolCallPending,
  executeLlmTool,
  sendChatMessage,
} from "../api/llm";
import type { ChatMessage, ToolCallPendingEvent } from "../api/llm";
import {
  chatMessagesAtom,
  isGeneratingAtom,
  activeToolCallAtom,
  currentSessionIdAtom,
} from "../store/LLMChatStore";
import { workspaceRootAtom } from "@/features/FileExplorer/store";

/**
 * Manages the full LLM streaming lifecycle:
 * - Subscribes to llm-token, llm-tool-call-pending, llm-done, llm-error
 * - Appends streamed tokens to the last assistant message
 * - Executes pending tool calls and injects results as tool messages
 * - Cleans up all listeners on unmount
 */
export function useLlmStream() {
  const setMessages = useSetAtom(chatMessagesAtom);
  const setIsGenerating = useSetAtom(isGeneratingAtom);
  const setActiveToolCall = useSetAtom(activeToolCallAtom);
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const sessionId = useAtomValue(currentSessionIdAtom);

  // Keep workspace root and session ID in refs so closures always see the latest values
  const workspaceRootRef = useRef(workspaceRoot);
  useEffect(() => {
    workspaceRootRef.current = workspaceRoot;
  }, [workspaceRoot]);

  const sessionIdRef = useRef(sessionId);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    let unlistenToken: (() => void) | null = null;
    let unlistenTool: (() => void) | null = null;
    let unlistenDone: (() => void) | null = null;
    let unlistenError: (() => void) | null = null;

    const setup = async () => {
      unlistenToken = await onLlmToken((token: string) => {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content + token },
            ];
          }
          // Start a new streaming assistant message
          return [...prev, { role: "assistant", content: token }];
        });
      });

      unlistenTool = await onLlmToolCallPending(
        async (event: ToolCallPendingEvent) => {
          setActiveToolCall(event);
          setIsGenerating(true); // Ensure generating state is active during tool execution

          // Execute the tool on the Rust side
          const wsRoot = workspaceRootRef.current ?? "";
          let output = "";
          try {
            output = await executeLlmTool(event.name, event.args, wsRoot);
          } catch (err) {
            output = JSON.stringify({ error: String(err) });
          }

          // Append tool result message
          const toolMsg: ChatMessage = {
            role: "tool",
            content: output,
            name: event.name,
          };
          
          let nextMessages: ChatMessage[] = [];
          setMessages((prev) => {
            nextMessages = [...prev, toolMsg];
            return nextMessages;
          });
          
          setActiveToolCall(null);

          // Recursively call sendChatMessage to submit the tool execution output back to the LLM
          try {
            const currentSession = sessionIdRef.current;
            await sendChatMessage(nextMessages, wsRoot, currentSession);
          } catch (err) {
            setIsGenerating(false);
            console.error("Failed to continue response after tool call:", err);
          }
        },
      );

      unlistenDone = await onLlmDone(() => {
        setIsGenerating(false);
        setActiveToolCall(null);
      });

      unlistenError = await onLlmError((msg: string) => {
        console.error("[LLM] Error:", msg);
        setIsGenerating(false);
        setActiveToolCall(null);
        // Append error as system message
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `⚠️ Error: ${msg}`,
          },
        ]);
      });
    };

    setup().catch(console.error);

    return () => {
      unlistenToken?.();
      unlistenTool?.();
      unlistenDone?.();
      unlistenError?.();
    };
  }, [setMessages, setIsGenerating, setActiveToolCall]);
}
