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
  const hasParts = Boolean(message.parts && message.parts.length > 0);
  const hasToolCalls = Boolean(message.toolCalls && message.toolCalls.length > 0);
  const hasContent = Boolean(message.content && message.content.trim().length > 0);

  return (
    <div className="flex flex-col items-start w-full">
      <div className="w-full max-w-[92%] text-xs leading-relaxed text-foreground space-y-2.5">
        {hasParts ? (
          message.parts!.map((part) => {
            if (part.type === "text") {
              if (!part.content.trim()) return null;
              return (
                <p key={part.id} className="whitespace-pre-wrap">
                  {part.content}
                </p>
              );
            } else if (part.type === "tool") {
              return <ToolCallCard key={part.id} log={part.toolCall} />;
            }
            return null;
          })
        ) : (
          <>
            {/* Fallback for legacy messages without chronological parts */}
            {hasToolCalls && (
              <div className="space-y-1">
                {message.toolCalls!.map((tc) => (
                  <ToolCallCard key={tc.id} log={tc} />
                ))}
              </div>
            )}
            {hasContent && <p className="whitespace-pre-wrap">{message.content}</p>}
          </>
        )}

        {/* Real-time generating / tool status indicator */}
        {isGenerating && (
          <div className="flex items-center gap-2 text-muted-foreground py-0.5">
            <LiquidOrb size={18} speed={1.3} />
            <span className="text-[11px]">
              {activeToolCall
                ? `Executing ${activeToolCall.toolName}...`
                : "Synthesizing response from Ollama..."}
            </span>
          </div>
        )}

        {/* Empty state when done and nothing produced */}
        {!isGenerating && !hasContent && !hasToolCalls && !hasParts && (
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
