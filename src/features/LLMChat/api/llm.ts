import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProviderType = "local" | "ollama" | "lm_studio" | "open_a_i" | "claude";

export interface LlmConfig {
  provider_type: ProviderType;
  local_model_path: string | null;
  custom_models_dir: string | null;
  api_endpoint: string | null;
  api_key: string | null;
  model_name: string | null;
  gpu_layers: number;
  ctx_size: number;
  max_tokens: number;
  system_prompt: string | null;
}

export interface LlmProviderStatus {
  loaded: boolean;
  provider_type: ProviderType;
  model_name: string | null;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  attachedFiles?: Array<{ name: string; path: string }>;
}

export interface GgufModelInfo {
  filename: string;
  path: string;
  size_bytes: number;
}

export interface ChatSessionMeta {
  id: string;
  created_at: string;
  model: string | null;
  provider: string;
  message_count: number;
  preview: string;
}

export interface ChatSession {
  id: string;
  created_at: string;
  model: string | null;
  provider: string;
  messages: Array<{
    role: string;
    content: string;
    timestamp: string;
    name?: string;
    tool_input?: unknown;
    tool_output?: unknown;
  }>;
}

export interface ToolCallPendingEvent {
  name: string;
  args: string;
}

// ─── Config API ───────────────────────────────────────────────────────────────

export const getLlmConfig = (): Promise<LlmConfig> =>
  invoke("get_llm_config");

export const saveLlmConfig = (config: LlmConfig): Promise<void> =>
  invoke("save_llm_config", { config });

// ─── Provider API ─────────────────────────────────────────────────────────────

export const loadLlmProvider = (): Promise<void> =>
  invoke("load_llm_provider");

export const unloadLlmProvider = (): Promise<void> =>
  invoke("unload_llm_provider");

export const getLlmProviderStatus = (): Promise<LlmProviderStatus> =>
  invoke("get_llm_provider_status");

// ─── Chat API ─────────────────────────────────────────────────────────────────

export const sendChatMessage = (
  messages: ChatMessage[],
  workspaceRoot: string,
  sessionId: string,
): Promise<void> => {
  const cleanedMessages = messages.map(({ role, content, name, tool_call_id }) => ({
    role,
    content,
    name: name || undefined,
    tool_call_id: tool_call_id || undefined,
  }));
  return invoke("send_chat_message", {
    messages: cleanedMessages,
    workspaceRoot,
    sessionId,
  });
};

export const executeLlmTool = (
  name: string,
  argsJson: string,
  workspaceRoot: string,
): Promise<string> =>
  invoke("execute_llm_tool", { name, argsJson, workspaceRoot });

export const cancelGeneration = (): Promise<void> =>
  invoke("cancel_generation");

// ─── Session API ──────────────────────────────────────────────────────────────

export const listChatSessions = (workspaceRoot: string): Promise<ChatSessionMeta[]> =>
  invoke("list_chat_sessions", { workspaceRoot });

export const loadChatSession = (
  workspaceRoot: string,
  sessionId: string,
): Promise<ChatSession> =>
  invoke("load_chat_session", { workspaceRoot, sessionId });

export const deleteChatSession = (
  workspaceRoot: string,
  sessionId: string,
): Promise<void> =>
  invoke("delete_chat_session", { workspaceRoot, sessionId });

// ─── Model Management API ─────────────────────────────────────────────────────

export const scanLocalLlmModels = (): Promise<GgufModelInfo[]> =>
  invoke("scan_local_llm_models");

export const downloadLlmModel = (url: string, filename: string): Promise<void> =>
  invoke("download_llm_model", { url, filename });

export const deleteLlmModel = (filename: string): Promise<void> =>
  invoke("delete_llm_model", { filename });

export const revealLlmModelsDir = (): Promise<void> =>
  invoke("reveal_llm_models_dir");

export const getLlmModelsDir = (): Promise<string> =>
  invoke("get_llm_models_dir");

// ─── Event Listeners ──────────────────────────────────────────────────────────

export const onLlmToken = (cb: (token: string) => void): Promise<UnlistenFn> =>
  listen<string>("llm-token", (e) => cb(e.payload));

export const onLlmToolCallPending = (
  cb: (event: ToolCallPendingEvent) => void,
): Promise<UnlistenFn> =>
  listen<ToolCallPendingEvent>("llm-tool-call-pending", (e) => cb(e.payload));

export const onLlmDone = (cb: () => void): Promise<UnlistenFn> =>
  listen("llm-done", () => cb());

export const onLlmError = (cb: (msg: string) => void): Promise<UnlistenFn> =>
  listen<string>("llm-error", (e) => cb(e.payload));

export const onLlmModelDownloadProgress = (
  cb: (progress: number) => void,
): Promise<UnlistenFn> =>
  listen<number>("llm-model-download-progress", (e) => cb(e.payload));

// ─── Grammar Correction ───────────────────────────────────────────────────────

export const grammarCorrectText = (text: string): Promise<string> =>
  invoke("grammar_correct_text", { text });

export const editTextWithAi = (text: string, instruction: string): Promise<string> =>
  invoke("edit_text_with_ai", { text, instruction });
