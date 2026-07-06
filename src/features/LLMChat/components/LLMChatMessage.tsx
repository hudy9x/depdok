import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage, ToolCallPendingEvent } from "../api/llm";
import { LLMChatToolCall } from "./LLMChatToolCall";

interface LLMChatMessageProps {
  message: ChatMessage;
  isStreaming?: boolean;
  activeToolCall?: ToolCallPendingEvent | null;
}

export function LLMChatMessage({ message, isStreaming, activeToolCall }: LLMChatMessageProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const isTool = message.role === "tool";

  if (isTool && message.name) {
    // Tool result — render as a tool call block
    const fakeEvent: ToolCallPendingEvent = {
      name: message.name,
      args: "{}",
    };
    return (
      <div className="px-4 py-1">
        <LLMChatToolCall toolCall={fakeEvent} output={message.content} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3",
        isUser && "flex-row-reverse",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted border border-border",
        )}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5" />
        ) : (
          <Bot className="h-3.5 w-3.5 text-primary" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "flex-1 min-w-0 space-y-1",
          isUser && "flex flex-col items-end",
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed max-w-[85%] break-words",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted/50 border border-border/40 text-foreground rounded-tl-sm",
          )}
        >
          {message.content}
          {isStreaming && isAssistant && (
            <span className="inline-block w-1 h-4 bg-primary ml-0.5 animate-pulse align-middle" />
          )}
        </div>

        {/* Active tool call shown below assistant bubble while pending */}
        {isAssistant && activeToolCall && (
          <div className="max-w-[85%] w-full">
            <LLMChatToolCall toolCall={activeToolCall} isPending />
          </div>
        )}
      </div>
    </div>
  );
}
