import React, { ComponentProps, useMemo } from "react";
import { defaultRehypePlugins, Streamdown } from "streamdown";

import { extractCitedSources } from "../lib/extractCitedSources";
import { ChatMessage, ToolExecutionLog } from "../store/LLMChat2Store";
import { AssistantThinkingIndicator } from "./AssistantThinkingIndicator";
import { CitationBadge } from "./CitationBadge";
import { ContextCompactedCard } from "./ContextCompactedCard";
import { ContextSlidingCard } from "./ContextSlidingCard";
import { SourcesBar } from "./SourcesBar";
import { ThoughtBlock } from "./ThoughtBlock";
import { ToolCallCard } from "./ToolCallCard";

export interface AssistantChatMessageProps {
  message: ChatMessage;
  isGenerating?: boolean;
  activeToolCall?: ToolExecutionLog | null;
}

/**
 * Configure Streamdown rehype plugins to whitelist internal citation schemes (cite:, depdok-cite:)
 * and prevent rehype-harden from stripping href or injecting "[blocked]" indicator spans.
 */
const streamdownRehypePlugins: ComponentProps<typeof Streamdown>["rehypePlugins"] = (() => {
  const sanitizeEntry = defaultRehypePlugins.sanitize;
  const hardenEntry = defaultRehypePlugins.harden;

  const sanitizePlugin = Array.isArray(sanitizeEntry) ? sanitizeEntry[0] : sanitizeEntry;
  const sanitizeConfig =
    Array.isArray(sanitizeEntry) && sanitizeEntry[1] ? (sanitizeEntry[1] as Record<string, any>) : {};

  const hardenPlugin = Array.isArray(hardenEntry) ? hardenEntry[0] : hardenEntry;
  const hardenConfig =
    Array.isArray(hardenEntry) && hardenEntry[1] ? (hardenEntry[1] as Record<string, any>) : {};

  const customSanitizeConfig = {
    ...sanitizeConfig,
    protocols: {
      ...sanitizeConfig?.protocols,
      href: [
        ...(Array.isArray(sanitizeConfig?.protocols?.href) ? sanitizeConfig.protocols.href : []),
        "cite",
        "depdok-cite",
      ],
    },
  };

  const customHardenConfig = {
    ...hardenConfig,
    linkBlockPolicy: "text-only",
    allowedProtocols: [
      ...(Array.isArray(hardenConfig?.allowedProtocols) ? hardenConfig.allowedProtocols : ["*"]),
      "cite:",
      "depdok-cite:",
    ],
  };

  return [
    defaultRehypePlugins.raw,
    [sanitizePlugin as any, customSanitizeConfig],
    [hardenPlugin as any, customHardenConfig],
  ];
})();

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

  // Extract cited knowledge base and web search sources from tool execution results
  const sources = useMemo(() => extractCitedSources(message), [message]);

  // Configure custom Streamdown components to intercept citation links (e.g. cite:1 or [^1])
  const streamdownComponents = useMemo(() => {
    return {
      span: ({ title, children, className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
        // Defensive fallback: If any upstream plugin marked a citation link as blocked,
        // intercept and restore it as an interactive CitationBadge instead of showing "[blocked]".
        if (title && title.startsWith("Blocked URL:")) {
          const rawUrl = title.replace(/^Blocked URL:\s*/, "").trim();
          let numId: number | null = null;
          if (rawUrl.startsWith("cite:") || rawUrl.startsWith("depdok-cite:")) {
            const parsed = parseInt(rawUrl.replace(/^(cite|depdok-cite):/, ""), 10);
            if (!isNaN(parsed)) numId = parsed;
          } else {
            const textMatch = String(children ?? "").match(/^(\d+)/);
            if (textMatch) {
              const parsed = parseInt(textMatch[1], 10);
              if (!isNaN(parsed)) numId = parsed;
            }
          }

          if (numId !== null) {
            return <CitationBadge citationId={numId} sources={sources} />;
          }
        }

        return (
          <span className={className} title={title} {...props}>
            {children}
          </span>
        );
      },
      a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
        if (href) {
          let numId: number | null = null;
          if (href.startsWith("cite:") || href.startsWith("depdok-cite:")) {
            const parsed = parseInt(href.replace(/^(cite|depdok-cite):/, ""), 10);
            if (!isNaN(parsed)) numId = parsed;
          } else if (
            href.startsWith("#fn") ||
            href.startsWith("#source-") ||
            href.startsWith("#source")
          ) {
            const rawText = String(children ?? "").replace(/\D/g, "");
            const parsed = parseInt(rawText, 10);
            if (!isNaN(parsed)) numId = parsed;
          }

          if (numId !== null) {
            return <CitationBadge citationId={numId} sources={sources} />;
          }

          // Block cite:/depdok-cite: schemes from navigating — Tauri WebView would mark them as [blocked]
          if (href.startsWith("cite:") || href.startsWith("depdok-cite:")) {
            return (
              <span
                className="inline-flex items-center justify-center min-w-[15px] h-[15px] px-1 text-[10px] font-mono font-medium rounded bg-muted/60 text-muted-foreground align-super select-none"
              >
                {children}
              </span>
            );
          }
        }

        return (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              // Prevent Tauri WebView from blocking unknown URL schemes
              if (href && !href.startsWith("http") && !href.startsWith("https")) {
                e.preventDefault();
              }
            }}
            className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
            {...props}
          >
            {children}
          </a>
        );
      },
    };
  }, [sources]);

  return (
    <div className="flex flex-col items-start w-full select-text">
      <div className="w-full max-w-[92%] text-xs leading-relaxed text-foreground space-y-2.5 select-text llm2-chat-markdown">
        {/* Compacted History Summary notice card */}
        {message.compacted && (
          <ContextCompactedCard info={message.compacted} />
        )}

        {/* Context Sliding Window & Compaction notice card */}
        {message.slidingWindow &&
          (message.slidingWindow.prunedTurns > 0 ||
            (message.slidingWindow.foldedTools ?? 0) > 0) && (
            <ContextSlidingCard info={message.slidingWindow} />
          )}

        {hasParts ? (
          <>
            {message.parts!.map((part, index) => {
              if (part.type === "thought") {
                if (!part.content.trim()) return null;
                const isLastPart = index === message.parts!.length - 1;
                return (
                  <ThoughtBlock
                    key={part.id}
                    content={part.content}
                    durationSeconds={part.durationSeconds}
                    isStreaming={isGenerating && isLastPart}
                  />
                );
              } else if (part.type === "tool") {
                return <ToolCallCard key={part.id} log={part.toolCall} />;
              } else if (part.type === "text") {
                if (!part.content.trim()) return null;
                return (
                  <Streamdown
                    key={part.id}
                    animated
                    caret="block"
                    rehypePlugins={streamdownRehypePlugins}
                    components={streamdownComponents}
                  >
                    {part.content}
                  </Streamdown>
                );
              }
              return null;
            })}

            {/* Referenced Sources overview bar */}
            {sources.length > 0 && <SourcesBar sources={sources} />}
          </>
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

            {/* Referenced Sources overview bar */}
            {sources.length > 0 && <SourcesBar sources={sources} />}

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
                    <Streamdown
                      animated
                      caret="block"
                      rehypePlugins={streamdownRehypePlugins}
                      components={streamdownComponents}
                    >
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
          hasStreamedContent={hasParts || hasContent || hasToolCalls}
        />

        {/* Empty state when done and nothing produced */}
        {!isGenerating && !hasContent && !hasToolCalls && !hasParts && (
          <p className="whitespace-pre-wrap italic text-muted-foreground">
            (No response generated)
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 px-1 mt-1 text-[9px] text-muted-foreground font-mono">
        <span>
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        {message.tokens?.completionTokens !== undefined && (
          <>
            <span>•</span>
            <span
              className="flex items-center gap-0.5 opacity-75 hover:opacity-100 transition-opacity cursor-default"
              title="Output tokens (completion tokens generated by model)"
            >
              <span>+{message.tokens.completionTokens.toLocaleString()} tokens</span>
            </span>
          </>
        )}
      </div>
    </div>
  );
};
