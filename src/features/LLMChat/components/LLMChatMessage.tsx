import { User, FileCode } from "lucide-react";
import type { ChatMessage, ToolCallPendingEvent } from "../api/llm";
import { LLMChatToolCall } from "./LLMChatToolCall";

import { Streamdown } from "streamdown";

interface LLMChatMessageProps {
  message: ChatMessage;
  isStreaming?: boolean;
  activeToolCall?: ToolCallPendingEvent | null;
}

export function LLMChatMessage({ message, isStreaming, activeToolCall }: LLMChatMessageProps) {
  const isAssistant = message.role === "assistant";
  const isTool = message.role === "tool";

  const contextDelimiter = "\n\n---\n**Attached File Context:**";
  let cleanContent = message.content.split(contextDelimiter)[0];
  if (isAssistant) {
    cleanContent = cleanContent.replace(/\[FILE:\s*.*?\]\s*\r?\n/g, "");
  }

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

  if (isAssistant) {
    return (
      <div className="px-4 py-3 border-b border-border/10 last:border-0">
        <div 
          className="prose prose-sm dark:prose-invert max-w-none text-foreground break-words leading-relaxed select-text [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:bg-muted/50 [&_code]:text-xs [&_code]:font-mono [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5"
          style={{ paddingBottom: 0 }}
        >
          <Streamdown>{cleanContent}</Streamdown>
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-primary ml-0.5 animate-pulse align-middle" />
          )}
        </div>
        
        {/* Active tool call shown below assistant content while pending */}
        {activeToolCall && (
          <div className="w-full mt-2">
            <LLMChatToolCall toolCall={activeToolCall} isPending />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-3 px-4 py-3 flex-row-reverse">
      {/* Avatar */}
      <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-primary text-primary-foreground">
        <User className="h-3.5 w-3.5" />
      </div>

      {/* Bubble */}
      <div className="flex-1 min-w-0 space-y-1 flex flex-col items-end">
        <div className="rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed max-w-[85%] break-words bg-primary text-primary-foreground rounded-tr-sm">
          {cleanContent}
          {message.attachedFiles && message.attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2 pt-1.5 border-t border-primary-foreground/10">
              {message.attachedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary-foreground/10 border border-primary-foreground/20 text-[10px] font-medium"
                  title={file.path}
                >
                  <FileCode className="h-3 w-3" />
                  <span className="truncate max-w-[120px]">{file.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
