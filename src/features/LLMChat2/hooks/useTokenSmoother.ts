import { useRef, useEffect, useCallback } from "react";
import { useSetAtom } from "jotai";
import { chat2MessagesAtom } from "../store/LLMChat2Store";

/**
 * useTokenSmoother
 *
 * Buffers incoming stream chunks from Ollama/Tauri and elastically
 * drains them via requestAnimationFrame to produce a smooth, high-frame-rate
 * typewriter effect that eliminates stream stutter and visual jitter.
 */
export function useTokenSmoother() {
  const setMessages = useSetAtom(chat2MessagesAtom);
  const queueMapRef = useRef<Map<string, string>>(new Map());
  const rafIdRef = useRef<number | null>(null);

  // Directly append a text chunk to a message's parts and full content
  const appendChunkToMessage = useCallback(
    (messageId: string, chunk: string) => {
      if (!chunk) return;
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg;

          const currentParts = msg.parts ? [...msg.parts] : [];
          const lastPartIndex = currentParts.length - 1;
          const lastPart = currentParts[lastPartIndex];

          if (lastPart && lastPart.type === "text") {
            currentParts[lastPartIndex] = {
              ...lastPart,
              content: lastPart.content + chunk,
            };
          } else {
            currentParts.push({
              type: "text",
              id: crypto.randomUUID(),
              content: chunk,
            });
          }

          return {
            ...msg,
            content: msg.content + chunk,
            parts: currentParts,
          };
        })
      );
    },
    [setMessages]
  );

  // Main animation frame loop that drains the pending character buffer elastically
  useEffect(() => {
    let isRunning = true;

    const tick = () => {
      if (!isRunning) return;

      for (const [msgId, pendingText] of queueMapRef.current.entries()) {
        const len = pendingText.length;
        if (len > 0) {
          // Adaptive draining speed based on queue depth
          let charsToDrain = 1;
          if (len > 120) {
            charsToDrain = Math.ceil(len / 3);
          } else if (len > 50) {
            charsToDrain = Math.ceil(len / 5);
          } else if (len > 15) {
            charsToDrain = Math.ceil(len / 8) + 1;
          } else if (len > 4) {
            charsToDrain = 2;
          } else {
            charsToDrain = 1;
          }

          const drainChunk = pendingText.slice(0, charsToDrain);
          const remainder = pendingText.slice(charsToDrain);

          if (remainder.length === 0) {
            queueMapRef.current.delete(msgId);
          } else {
            queueMapRef.current.set(msgId, remainder);
          }

          appendChunkToMessage(msgId, drainChunk);
        } else {
          queueMapRef.current.delete(msgId);
        }
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      isRunning = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [appendChunkToMessage]);

  // Push incoming token chunk to queue
  const enqueueToken = useCallback((messageId: string, chunk: string) => {
    if (!chunk) return;
    const current = queueMapRef.current.get(messageId) || "";
    queueMapRef.current.set(messageId, current + chunk);
  }, []);

  // Flush all pending text for a message immediately (e.g. when generation finishes)
  const flush = useCallback(
    (messageId: string) => {
      const remaining = queueMapRef.current.get(messageId);
      if (remaining && remaining.length > 0) {
        queueMapRef.current.delete(messageId);
        appendChunkToMessage(messageId, remaining);
      }
    },
    [appendChunkToMessage]
  );

  // Clear everything (e.g. on abort or reset)
  const clearAll = useCallback(() => {
    queueMapRef.current.clear();
  }, []);

  return {
    enqueueToken,
    flush,
    clearAll,
  };
}
