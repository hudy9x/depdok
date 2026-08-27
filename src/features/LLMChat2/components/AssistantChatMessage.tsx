import React from "react";
import { Streamdown } from "streamdown";

import { ChatMessage, ToolExecutionLog } from "../store/LLMChat2Store";
import { AssistantThinkingIndicator } from "./AssistantThinkingIndicator";
import { ToolCallCard } from "./ToolCallCard";
import { ThoughtBlock } from "./ThoughtBlock";

export interface AssistantChatMessageProps {
  message: ChatMessage;
  isGenerating?: boolean;
  activeToolCall?: ToolExecutionLog | null;
}

/**
 * Detects whether a text snippet contains an inner monologue / planning scratchpad
 * or <think> tags, and splits it into thought + answer.
 */
function splitMonologueFromText(text: string): { thought?: string; answer?: string } {
  const trimmed = text.trim();
  if (!trimmed) return {};

  // 1. Check for <think>...</think> tags
  const thinkMatch = trimmed.match(/^<think>([\s\S]*?)<\/think>\s*([\s\S]*)$/i);
  if (thinkMatch) {
    return {
      thought: thinkMatch[1].trim(),
      answer: thinkMatch[2].trim(),
    };
  }

  // 2. Check for multi-paragraph scratchpad monologue at start of answer
  // e.g. "The user wants to check the owner of files... I just ran ls -l..."
  // followed by "\n\nFrom the output, I can see: ..."
  const doubleNewlineIndex = trimmed.indexOf("\n\n");
  if (doubleNewlineIndex !== -1) {
    const firstPara = trimmed.slice(0, doubleNewlineIndex).trim();
    const rest = trimmed.slice(doubleNewlineIndex + 2).trim();

    const isMonologue =
      /^(the user (wants|is asking|needs|requested)|let me (use|check|analyze|run|inspect|look)|i (can use|need to|will now|just ran|should check))\b/i.test(
        firstPara
      );

    if (isMonologue && rest.length > 0) {
      return { thought: firstPara, answer: rest };
    }
  }

  return { answer: trimmed };
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
    <div className="flex flex-col items-start w-full select-text">
      <div className="w-full max-w-[92%] text-xs leading-relaxed text-foreground space-y-2.5 select-text">
        {hasParts ? (
          message.parts!.map((part) => {
            if (part.type === "thought") {
              if (!part.content.trim()) return null;
              return (
                <ThoughtBlock
                  key={part.id}
                  content={part.content}
                  durationSeconds={part.durationSeconds}
                  isStreaming={isGenerating}
                />
              );
            } else if (part.type === "text") {
              if (!part.content.trim()) return null;
              return (
                <Streamdown key={part.id} animated caret="block">
                  {part.content}
                </Streamdown>
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
              <div className="space-y-1 select-none">
                {message.toolCalls!.map((tc) => (
                  <ToolCallCard key={tc.id} log={tc} />
                ))}
              </div>
            )}
            {hasContent && (() => {
              const { thought, answer } = splitMonologueFromText(message.content);
              return (
                <>
                  {thought && (
                    <ThoughtBlock
                      content={thought}
                      isStreaming={isGenerating && !answer}
                    />
                  )}
                  {answer && (
                    <Streamdown animated caret="block">
                      {answer}
                    </Streamdown>
                  )}
                </>
              );
            })()}
          </>
        )}

        {/* Real-time generating / tool status indicator */}
        <AssistantThinkingIndicator
          isGenerating={isGenerating}
          activeToolCall={activeToolCall}
        />

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
