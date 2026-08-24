import React from "react";
import { LiquidOrb } from "@/components/LiquidOrb";
import { ChatMessage, ToolExecutionLog } from "../store/LLMChat2Store";
import { ToolCallCard } from "./ToolCallCard";

export interface AssistantChatMessageProps {
  message: ChatMessage;
  isGenerating?: boolean;
  activeToolCall?: ToolExecutionLog | null;
}

export const AssistantChatMessage: React.FC<AssistantChatMessageProps> = ({
  message,
  isGenerating = false,
  activeToolCall = null,
}) => {
  const hasToolCalls = Boolean(message.toolCalls && message.toolCalls.length > 0);
  const isEmptyAndGenerating = isGenerating && !message.content;

  return (
    <div className="flex flex-col items-start">
      <div className="max-w-[88%] text-xs leading-relaxed text-foreground">
        {/* Inline Tool Call Cards */}
        {hasToolCalls && (
          <div className="mb-2 space-y-1">
            {message.toolCalls!.map((tc) => (
              <ToolCallCard key={tc.id} log={tc} />
            ))}
          </div>
        )}

        {isEmptyAndGenerating ? (
          <div className="flex items-center gap-2 text-muted-foreground py-0.5">
            <LiquidOrb size={20} speed={1.3} />
            <span>
              {activeToolCall
                ? `Executing ${activeToolCall.toolName}...`
                : "Synthesizing response from Ollama..."}
            </span>
          </div>
        ) : message.content ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : hasToolCalls ? null : (
          <p className="whitespace-pre-wrap italic text-muted-foreground">
            (No response generated)
          </p>
        )}
      </div>
      <span className="text-[9px] text-muted-foreground px-1 mt-1 font-mono">
        {new Date(message.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
};
