import { atom } from "jotai";
import type { ChatMessage, ChatSessionMeta, GgufModelInfo, LlmConfig, LlmProviderStatus, ToolCallPendingEvent } from "../api/llm";

// ─── UI State ─────────────────────────────────────────────────────────────────

export const isChatOpenAtom = atom(false);

// ─── Session State ────────────────────────────────────────────────────────────

/** Current active session ID — generated fresh on first open */
export const currentSessionIdAtom = atom<string>(generateSessionId());

/** All messages in the current session */
export const chatMessagesAtom = atom<ChatMessage[]>([]);

/** Whether the LLM is currently generating */
export const isGeneratingAtom = atom(false);

/** The currently active tool call being executed */
export const activeToolCallAtom = atom<ToolCallPendingEvent | null>(null);

/** List of past chat sessions */
export const chatSessionsAtom = atom<ChatSessionMeta[]>([]);

// ─── Provider State ───────────────────────────────────────────────────────────

export const llmProviderStatusAtom = atom<LlmProviderStatus | null>(null);
export const llmConfigAtom = atom<LlmConfig | null>(null);

// ─── Model Management ─────────────────────────────────────────────────────────

export const localGgufModelsAtom = atom<GgufModelInfo[]>([]);
export const modelDownloadProgressAtom = atom<number | null>(null);

// ─── Helper ───────────────────────────────────────────────────────────────────

function generateSessionId(): string {
  const now = new Date()
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\.\d+Z$/, "");
  const rand = Math.random().toString(36).slice(2, 10);
  return `${now}_${rand}`;
}

export { generateSessionId };
