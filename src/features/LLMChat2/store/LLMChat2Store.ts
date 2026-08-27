import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { localStorageDriver } from "@/lib/storage";

export interface ToolExecutionLog {
  id: string;
  requestId: string;
  toolName: string;
  args: unknown;
  result?: unknown;
  status: "executing" | "success" | "error";
  error?: string;
  timestamp: Date;
}

export interface MessagePartText {
  type: "text";
  id: string;
  content: string;
}

export interface MessagePartThought {
  type: "thought";
  id: string;
  content: string;
  durationSeconds?: number;
}

export interface MessagePartTool {
  type: "tool";
  id: string;
  toolCall: ToolExecutionLog;
}

export type MessagePart = MessagePartText | MessagePartTool | MessagePartThought;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolExecutionLog[];
  parts?: MessagePart[];
  timestamp: Date;
}

export interface ContextMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  numCtx: number;
  percentConsumed: number;
  remainingTokens: number;
}

export interface Skill {
  name: string;
  description: string;
  tools: string[];
  body: string;
  filePath?: string;
}

export const isChat2OpenAtom = atom<boolean>(false);
export const chat2MessagesAtom = atom<ChatMessage[]>([]);
export const chat2LogsAtom = atom<ToolExecutionLog[]>([]);
export const activeToolCallAtom = atom<ToolExecutionLog | null>(null);
export const isGeneratingAtom = atom<boolean>(false);
export const chat2ModelAtom = atomWithStorage<string>("llm2_active_model", "qwen2.5:7b", localStorageDriver);
export const chat2IsStatefulAtom = atomWithStorage<boolean>("llm2_stateful_history", true, localStorageDriver);
export const chat2NumCtxAtom = atomWithStorage<number>("llm2_num_ctx", 16384, localStorageDriver);
export const chat2PanelWidthAtom = atomWithStorage<number>("llm2_panel_width", 420, localStorageDriver);
export const chat2WebSearchEnabledAtom = atomWithStorage<boolean>("llm2_web_search_enabled", false, localStorageDriver);
export const chat2ThinkingEnabledAtom = atomWithStorage<boolean>("llm2_thinking_enabled", true, localStorageDriver);
export const chat2MetricsAtom = atom<ContextMetrics | null>(null);

// Skill state
export const availableSkillsAtom = atom<Skill[]>([]);
export const activeSkillAtom = atom<Skill | null>(null);

// MCP state
export const mcpServersAtom = atom<import("@/api-client/mcp").McpServerSummary[]>([]);
export const isReloadingMcpAtom = atom<boolean>(false);





