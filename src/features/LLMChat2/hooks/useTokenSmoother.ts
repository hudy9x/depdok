import { useRef, useEffect, useCallback } from "react";
import { useSetAtom } from "jotai";
import { chat2MessagesAtom } from "../store/LLMChat2Store";

interface QueuedChunk {
  type: "text" | "thought";
  text: string;
}

/**
 * useTokenSmoother
 *
 * Buffers incoming stream chunks from Ollama/Tauri in a strict FIFO queue
 * and elastically drains them via requestAnimationFrame to produce a smooth,
 * high-frame-rate typewriter effect without stream stutter or chunk fragmentation.
 */
export function useTokenSmoother() {
  const setMessages = useSetAtom(chat2MessagesAtom);
  const queueMapRef = useRef<Map<string, QueuedChunk[]>>(new Map());
  const rafIdRef = useRef<number | null>(null);

  // Append drained chunk to the message's parts and full content
  const appendChunkToMessage = useCallback(
    (messageId: string, type: "text" | "thought", chunk: string) => {
      if (!chunk) return;
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg;

          const currentParts = msg.parts ? [...msg.parts] : [];
          const lastPartIndex = currentParts.length - 1;
          const lastPart = currentParts[lastPartIndex];

          if (lastPart && lastPart.type === type) {
            currentParts[lastPartIndex] = {
              ...lastPart,
              content: lastPart.content + chunk,
            };
          } else {
            currentParts.push({
              type,
              id: crypto.randomUUID(),
              content: chunk,
            });
          }

          return {
            ...msg,
            content: type === "text" ? msg.content + chunk : msg.content,
            parts: currentParts,
          };
        })
      );
    },
    [setMessages]
  );

  // Main animation frame loop that drains the pending character buffer elastically in FIFO order
  useEffect(() => {
    let isRunning = true;

    const tick = () => {
      if (!isRunning) return;

      for (const [msgId, queue] of queueMapRef.current.entries()) {
        if (!queue || queue.length === 0) {
          queueMapRef.current.delete(msgId);
          continue;
        }

        const head = queue[0];
        const len = head.text.length;

        if (len > 0) {
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

          const drainChunk = head.text.slice(0, charsToDrain);
          const remainder = head.text.slice(charsToDrain);

          if (remainder.length === 0) {
            queue.shift();
            if (queue.length === 0) {
              queueMapRef.current.delete(msgId);
            }
          } else {
            head.text = remainder;
          }

          appendChunkToMessage(msgId, head.type, drainChunk);
        } else {
          queue.shift();
          if (queue.length === 0) {
            queueMapRef.current.delete(msgId);
          }
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

  // Push incoming token chunk to FIFO queue (merges with tail if same type)
  const enqueueToken = useCallback((messageId: string, chunk: string) => {
    if (!chunk) return;
    const queue = queueMapRef.current.get(messageId) || [];
    const last = queue[queue.length - 1];
    if (last && last.type === "text") {
      last.text += chunk;
    } else {
      queue.push({ type: "text", text: chunk });
    }
    queueMapRef.current.set(messageId, queue);
  }, []);

  // Push incoming thought chunk to FIFO queue (merges with tail if same type)
  const enqueueThought = useCallback((messageId: string, chunk: string) => {
    if (!chunk) return;
    const queue = queueMapRef.current.get(messageId) || [];
    const last = queue[queue.length - 1];
    if (last && last.type === "thought") {
      last.text += chunk;
    } else {
      queue.push({ type: "thought", text: chunk });
    }
    queueMapRef.current.set(messageId, queue);
  }, []);

  // Flush all pending text for a message immediately (e.g. when generation finishes)
  const flush = useCallback(
    (messageId: string) => {
      const queue = queueMapRef.current.get(messageId);
      if (queue && queue.length > 0) {
        queueMapRef.current.delete(messageId);
        for (const item of queue) {
          if (item.text) {
            appendChunkToMessage(messageId, item.type, item.text);
          }
        }
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
    enqueueThought,
    flush,
    clearAll,
  };
}
