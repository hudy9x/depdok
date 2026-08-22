import { useState, useRef, useEffect, useCallback } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { toast } from "sonner";

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
  chat2MetricsAtom,
  ChatMessage,
} from "../store/LLMChat2Store";
import { useToolListener } from "../hooks/useToolListener";
import { FileMentionPopup, MentionItem } from "./FileMentionPopup";
import { ToolCallCard } from "./ToolCallCard";
import { QuickPromptChips } from "./QuickPromptChips";
import { ContextUsageGauge } from "./ContextUsageGauge";
import { LLMChat2HeaderActions } from "./LLMChat2HeaderActions";

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
      if (msg.toolCalls && msg.toolCalls.length > 0) {
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
  const [model, setModel] = useAtom(chat2ModelAtom);
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
        prev.map((msg) =>
          msg.id === message_id ? { ...msg, content: msg.content + chunk } : msg
        )
      );
    }).then((unlisten) => {
      unlistenToken = unlisten;
    });

    listen<{ message_id: string; content: string }>("llm2_done", (event) => {
      const { message_id, content } = event.payload;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === message_id ? { ...msg, content: content || msg.content } : msg
        )
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

  const handleSelectPrompt = (promptText: string) => {
    setInputVal(promptText);
    inputRef.current?.focus();
  };

  if (!isChatOpen) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col w-[520px] h-[720px] max-h-[calc(100vh-32px)] rounded-2xl border border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 shrink-0 bg-muted/20">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20">
          <Sparkles className="h-4 w-4 text-sky-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground leading-tight">AI Chat v2</p>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-medium">
              Live Stream
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-muted-foreground">Model:</span>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="text-[10px] bg-transparent hover:bg-muted/40 px-1 py-0.5 rounded border border-transparent hover:border-border/40 text-foreground font-mono w-28 focus:outline-none focus:border-sky-500/50"
              title="Click to edit Ollama model name"
            />
          </div>
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
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-sky-500" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Frontend Tool-Calling v2</p>
              <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                Live streaming tokens from local Ollama.
                Type <code className="text-sky-400 font-semibold">@</code> to mention files, review &amp; update markdown live.
              </p>
            </div>

            {/* Quick Test Prompt Chips */}
            <QuickPromptChips onSelectPrompt={handleSelectPrompt} />
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isAssistant = msg.role === "assistant";
              const hasToolCalls = Boolean(msg.toolCalls && msg.toolCalls.length > 0);
              const isEmptyAndGenerating = isAssistant && isGenerating && !msg.content;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-muted/60 border border-border/50 text-foreground rounded-bl-none"
                    }`}
                  >
                    {/* Inline Tool Call Cards */}
                    {hasToolCalls && (
                      <div className="mb-2 space-y-1">
                        {msg.toolCalls!.map((tc) => (
                          <ToolCallCard key={tc.id} log={tc} />
                        ))}
                      </div>
                    )}

                    {isEmptyAndGenerating ? (
                      <div className="flex items-center gap-2 text-muted-foreground py-0.5">
                        <Loader2 className="h-3 w-3 animate-spin text-sky-500" />
                        <span>
                          {activeToolCall
                            ? `Executing ${activeToolCall.toolName}...`
                            : "Synthesizing response from Ollama..."}
                        </span>
                      </div>
                    ) : msg.content ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : hasToolCalls ? null : (
                      <p className="whitespace-pre-wrap italic text-muted-foreground">
                        (No response generated)
                      </p>
                    )}
                  </div>
                  <span className="text-[9px] text-muted-foreground px-1 mt-1 font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}

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
