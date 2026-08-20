import { atom } from "jotai";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

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

export const isChat2OpenAtom = atom<boolean>(false);
export const chat2MessagesAtom = atom<ChatMessage[]>([]);
export const chat2LogsAtom = atom<ToolExecutionLog[]>([]);
export const activeToolCallAtom = atom<ToolExecutionLog | null>(null);
export const isGeneratingAtom = atom<boolean>(false);
export const chat2ModelAtom = atom<string>("qwen3.5:4b");
