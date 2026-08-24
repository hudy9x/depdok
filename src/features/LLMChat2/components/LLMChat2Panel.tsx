import { useState, useRef, useEffect, useCallback } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Send, Loader2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { LiquidOrb } from "@/components/LiquidOrb";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  isChat2OpenAtom,
  chat2MessagesAtom,
  chat2LogsAtom,
  activeToolCallAtom,
  isGeneratingAtom,
  chat2ModelAtom,
  chat2IsStatefulAtom,
  chat2NumCtxAtom,
  chat2PanelWidthAtom,
  chat2MetricsAtom,
  ChatMessage,
  ToolExecutionLog,
} from "../store/LLMChat2Store";
import { useToolListener } from "../hooks/useToolListener";
import { FileMentionPopup, MentionItem } from "./FileMentionPopup";
import { ToolCallCard } from "./ToolCallCard";
import { EmptyChatGuide } from "./EmptyChatGuide";
import { UserChatMessage } from "./UserChatMessage";
import { AssistantChatMessage } from "./AssistantChatMessage";
import { ContextUsageGauge } from "./ContextUsageGauge";
import { LLMChat2HeaderActions } from "./LLMChat2HeaderActions";
import { ModelSelector } from "./ModelSelector";

interface OllamaMessagePayload {
  role: string;
  content: string;
  tool_calls?: Array<{
    function: {
      name: string;
      arguments: unknown;
    };
  }>;
}

function formatHistoryForBackend(messages: ChatMessage[]): OllamaMessagePayload[] {
  const result: OllamaMessagePayload[] = [];

  for (const msg of messages) {
    if (msg.role === "user") {
      if (msg.content.trim()) {
        result.push({ role: "user", content: msg.content.trim() });
      }
    } else if (msg.role === "assistant") {
      if (msg.parts && msg.parts.length > 0) {
        let currentAssistantText = "";
        const pendingToolCalls: ToolExecutionLog[] = [];

        for (const part of msg.parts) {
          if (part.type === "text") {
            if (pendingToolCalls.length > 0) {
              result.push({
                role: "assistant",
                content: currentAssistantText,
                tool_calls: pendingToolCalls.map((tc) => ({
                  function: {
                    name: tc.toolName,
                    arguments: tc.args,
                  },
                })),
              });
              for (const tc of pendingToolCalls) {
                if (tc.status === "success" && tc.result !== undefined) {
                  result.push({
                    role: "tool",
                    content: typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result),
                  });
                }
              }
              currentAssistantText = "";
              pendingToolCalls.length = 0;
            }
            currentAssistantText += (currentAssistantText ? "\n\n" : "") + part.content;
          } else if (part.type === "tool") {
            pendingToolCalls.push(part.toolCall);
          }
        }

        if (pendingToolCalls.length > 0) {
          result.push({
            role: "assistant",
            content: currentAssistantText,
            tool_calls: pendingToolCalls.map((tc) => ({
              function: {
                name: tc.toolName,
                arguments: tc.args,
              },
            })),
          });
          for (const tc of pendingToolCalls) {
            if (tc.status === "success" && tc.result !== undefined) {
              result.push({
                role: "tool",
                content: typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result),
              });
            }
          }
        } else if (currentAssistantText.trim()) {
          result.push({
            role: "assistant",
            content: currentAssistantText.trim(),
          });
        }
      } else if (msg.toolCalls && msg.toolCalls.length > 0) {
        result.push({
          role: "assistant",
          content: msg.content || "",
          tool_calls: msg.toolCalls.map((tc) => ({
            function: {
              name: tc.toolName,
              arguments: tc.args,
            },
          })),
        });

        for (const tc of msg.toolCalls) {
          if (tc.status === "success" && tc.result !== undefined) {
            result.push({
              role: "tool",
              content: typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result),
            });
          }
        }
      } else if (msg.content.trim()) {
        result.push({ role: "assistant", content: msg.content.trim() });
      }
    }
  }

  return result;
}

export function LLMChat2Panel() {
  const isChatOpen = useAtomValue(isChat2OpenAtom);
  const [messages, setMessages] = useAtom(chat2MessagesAtom);
  const [isGenerating, setIsGenerating] = useAtom(isGeneratingAtom);
  const model = useAtomValue(chat2ModelAtom);
  const isStateful = useAtomValue(chat2IsStatefulAtom);
  const numCtx = useAtomValue(chat2NumCtxAtom);
  const setMetrics = useSetAtom(chat2MetricsAtom);
  const logs = useAtomValue(chat2LogsAtom);
  const activeToolCall = useAtomValue(activeToolCallAtom);

  const [inputVal, setInputVal] = useState("");
  const [showToolDrawer, setShowToolDrawer] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mention state
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [mentionItems, setMentionItems] = useState<MentionItem[]>([]);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  // Mount tool listener hook
  const { clearLogs } = useToolListener();

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Scroll to bottom once when chat panel opens
  useEffect(() => {
    if (isChatOpen) {
      setTimeout(() => {
        scrollToBottom("auto");
      }, 50);
    }
  }, [isChatOpen, scrollToBottom]);

  // Real-time token streaming and metrics listener
  useEffect(() => {
    let unlistenToken: UnlistenFn | null = null;
    let unlistenDone: UnlistenFn | null = null;
    let unlistenMetrics: UnlistenFn | null = null;

    listen<{ message_id: string; chunk: string }>("llm2_token", (event) => {
      const { message_id, chunk } = event.payload;
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== message_id) return msg;

          const currentParts = msg.parts ? [...msg.parts] : [];
          const lastPartIndex = currentParts.length - 1;
          const lastPart = currentParts[lastPartIndex];

          if (lastPart && lastPart.type === "text") {
            currentParts[lastPartIndex] = {
              ...lastPart,
              content: lastPart.content + chunk,
            };
          } else {
            currentParts.push({
              type: "text",
              id: crypto.randomUUID(),
              content: chunk,
            });
          }

          return {
            ...msg,
            content: msg.content + chunk,
            parts: currentParts,
          };
        })
      );
    }).then((unlisten) => {
      unlistenToken = unlisten;
    });

    listen<{ message_id: string; content: string }>("llm2_done", (event) => {
      const { message_id, content } = event.payload;
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== message_id) return msg;
          return {
            ...msg,
            content: msg.content || content,
          };
        })
      );
    }).then((unlisten) => {
      unlistenDone = unlisten;
    });

    listen<{
      message_id: string;
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
      num_ctx: number;
      percent_consumed: number;
      remaining_tokens: number;
    }>("llm2_metrics", (event) => {
      setMetrics({
        promptTokens: event.payload.prompt_tokens,
        completionTokens: event.payload.completion_tokens,
        totalTokens: event.payload.total_tokens,
        numCtx: event.payload.num_ctx,
        percentConsumed: event.payload.percent_consumed,
        remainingTokens: event.payload.remaining_tokens,
      });
    }).then((unlisten) => {
      unlistenMetrics = unlisten;
    });

    return () => {
      unlistenToken?.();
      unlistenDone?.();
      unlistenMetrics?.();
    };
  }, [setMessages, setMetrics]);

  // Check for '@' trigger in input text
  const checkMentionTrigger = (text: string, cursorPosition: number) => {
    const textBeforeCursor = text.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      // Check that there is no space between @ and cursor
      const query = textBeforeCursor.slice(lastAtIndex + 1);
      if (!/\s/.test(query)) {
        setIsMentionOpen(true);
        setMentionQuery(query);
        setMentionStartIndex(lastAtIndex);
        setSelectedMentionIndex(0);
        return;
      }
    }

    setIsMentionOpen(false);
    setMentionQuery("");
    setMentionStartIndex(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart ?? val.length;
    setInputVal(val);
    checkMentionTrigger(val, cursor);
  };

  const handleSelectMention = (item: MentionItem) => {
    if (mentionStartIndex === null) return;

    const before = inputVal.slice(0, mentionStartIndex);
    const after = inputVal.slice(mentionStartIndex + 1 + mentionQuery.length);
    const replacement = `@${item.relativePath} `;
    const newVal = `${before}${replacement}${after}`;

    setInputVal(newVal);
    setIsMentionOpen(false);
    setMentionQuery("");
    setMentionStartIndex(null);

    // Focus input and set cursor position after inserted mention
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const nextPos = before.length + replacement.length;
        inputRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 10);
  };

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputVal).trim();
    if (!textToSend || isGenerating) return;

    const historyPayload = isStateful ? formatHistoryForBackend(messages) : undefined;

    const assistantMsgId = crypto.randomUUID();
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: textToSend,
      timestamp: new Date(),
    };

    const placeholderAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      toolCalls: [],
      parts: [],
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg, placeholderAssistantMsg]);
    setInputVal("");
    setIsMentionOpen(false);
    setIsGenerating(true);

    // Scroll to bottom when user sends a message
    setTimeout(() => {
      scrollToBottom("smooth");
    }, 50);

    try {
      const response = await invoke<string>("llm2_send_message", {
        prompt: textToSend,
        model: model.trim() || undefined,
        messageId: assistantMsgId,
        message_id: assistantMsgId,
        history: historyPayload,
        numCtx: numCtx,
        num_ctx: numCtx,
      });

      // Ensure final assistant message has full content if stream was missed or buffered
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: msg.content.trim() ? msg.content : response }
            : msg
        )
      );
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(`LLM error: ${errorMsg}`);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
              ...msg,
              content: `⚠️ **Error executing request:** ${errorMsg}\n\n*Make sure Ollama is running locally (\`ollama run ${model}\`)*`,
            }
            : msg
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isMentionOpen && mentionItems.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev + 1) % mentionItems.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev - 1 + mentionItems.length) % mentionItems.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const selected = mentionItems[selectedMentionIndex] || mentionItems[0];
        if (selected) {
          handleSelectMention(selected);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setIsMentionOpen(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const [panelWidth, setPanelWidth] = useAtom(chat2PanelWidthAtom);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = panelWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = startX - moveEvent.clientX;
        const nextWidth = Math.max(300, Math.min(800, startWidth + delta));
        setPanelWidth(nextWidth);
      };

      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [panelWidth, setPanelWidth]
  );

  const handleSelectPrompt = (promptText: string) => {
    setInputVal(promptText);
    inputRef.current?.focus();
  };

  if (!isChatOpen) return null;

  return (
    <div
      className="h-full flex flex-col shrink-0 relative bg-layout-chrome border-l border-border select-none overflow-hidden pt-[38px]"
      style={{ width: panelWidth }}
    >
      {/* Drag handle on left border */}
      <div
        className="absolute top-0 bottom-0 left-0 w-1.5 z-20 cursor-ew-resize hover:bg-primary/40 transition-colors"
        style={{ background: "transparent" }}
        onMouseDown={handleDragStart}
      />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 shrink-0 bg-muted/20">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 shrink-0">
          <LiquidOrb size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <ModelSelector />
        </div>

        {/* Header Action Buttons & History Switch */}
        <LLMChat2HeaderActions
          showToolDrawer={showToolDrawer}
          onToggleToolDrawer={() => setShowToolDrawer((prev) => !prev)}
          onClearLogs={clearLogs}
        />
      </div>

      {/* Real-time Tool Execution Drawer (Collapsible) */}
      {showToolDrawer && (
        <div className="border-b border-border/60 bg-muted/10 p-3 max-h-56 overflow-y-auto space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Tool Monitor ({logs.length})
            </p>
            {logs.length > 0 && (
              <button
                onClick={clearLogs}
                className="text-[10px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              >
                Clear logs
              </button>
            )}
          </div>

          {logs.length === 0 ? (
            <p className="text-xs text-muted-foreground/70 italic py-2 text-center">
              No tool executions yet. Mention actions like creating files, reading markdown, or asking database queries.
            </p>
          ) : (
            <div className="space-y-1.5">
              {logs.map((log) => (
                <ToolCallCard key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <EmptyChatGuide onSelectPrompt={handleSelectPrompt} />
        ) : (
          <>
            {messages.map((msg) =>
              msg.role === "user" ? (
                <UserChatMessage key={msg.id} message={msg} />
              ) : (
                <AssistantChatMessage
                  key={msg.id}
                  message={msg}
                  isGenerating={isGenerating}
                  activeToolCall={activeToolCall}
                />
              )
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Active tool activity footer banner */}
      {activeToolCall && (
        <div className="px-4 py-1.5 bg-sky-500/10 border-t border-sky-500/20 flex items-center justify-between text-[11px] text-sky-400 shrink-0">
          <div className="flex items-center gap-1.5 font-mono">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Frontend executing: {activeToolCall.toolName}</span>
          </div>
          <span className="text-[10px] text-sky-500/80">Awaiting React bridge...</span>
        </div>
      )}

      {/* Context Window Usage Gauge & Settings (Bottom, Above Chat Input) */}
      <ContextUsageGauge />

      {/* Input Form with @ Mention Popup */}
      <div className="p-3 border-t border-border/60 bg-muted/20 shrink-0 relative">
        <FileMentionPopup
          isOpen={isMentionOpen}
          query={mentionQuery}
          selectedIndex={selectedMentionIndex}
          onSelect={handleSelectMention}
          onClose={() => setIsMentionOpen(false)}
          onItemsChange={setMentionItems}
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <Input
            ref={inputRef}
            value={inputVal}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isGenerating ? "Streaming response..." : "Ask a query, edit markdown, or type @ to mention files..."}
            disabled={isGenerating}
            className="text-xs h-9 bg-background/80 border-border/60 focus-visible:ring-sky-500/50"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!inputVal.trim() || isGenerating}
            className="h-9 w-9 shrink-0 bg-sky-500 hover:bg-sky-600 text-white cursor-pointer"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
