import { useState, useRef, useEffect, useCallback } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Sparkles, X, Trash2, Send, Activity, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
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
  ChatMessage,
} from "../store/LLMChat2Store";
import { useToolListener } from "../hooks/useToolListener";
import { FileMentionPopup, MentionItem } from "./FileMentionPopup";

export function LLMChat2Panel() {
  const [isChatOpen, setIsChatOpen] = useAtom(isChat2OpenAtom);
  const [messages, setMessages] = useAtom(chat2MessagesAtom);
  const [isGenerating, setIsGenerating] = useAtom(isGeneratingAtom);
  const [model, setModel] = useAtom(chat2ModelAtom);
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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating, scrollToBottom]);

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

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: textToSend,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputVal("");
    setIsMentionOpen(false);
    setIsGenerating(true);

    try {
      const response = await invoke<string>("llm2_send_message", {
        prompt: textToSend,
        model: model.trim() || undefined,
      });

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(`LLM error: ${errorMsg}`);
      const errorAssistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `⚠️ **Error executing request:** ${errorMsg}\n\n*Make sure Ollama is running locally (\`ollama run ${model}\`)*`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorAssistantMsg]);
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

  const handleClear = () => {
    setMessages([]);
    clearLogs();
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
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-500 font-medium">
              Rig + Ollama
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

        <div className="flex items-center gap-1">
          {/* Tool Monitor Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className={`h-6 w-6 cursor-pointer transition-colors relative ${
              showToolDrawer ? "text-sky-500 bg-sky-500/10" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setShowToolDrawer(!showToolDrawer)}
            title="Toggle Live Tool Execution Monitor"
          >
            <Activity className="h-3.5 w-3.5" />
            {logs.length > 0 && (
              <span className="absolute -top-1 -right-1 text-[8px] font-bold px-1 rounded-full bg-sky-500 text-white leading-tight">
                {logs.length}
              </span>
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={handleClear}
            title="Clear conversation and tool logs"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => setIsChatOpen(false)}
            title="Close AI v2 chat"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Tool Execution Monitor Drawer (Collapsible) */}
      {showToolDrawer && (
        <div className="border-b border-border/60 bg-muted/40 max-h-48 overflow-y-auto px-3 py-2 text-xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-border/30 mb-2">
            <span className="font-semibold text-muted-foreground flex items-center gap-1 text-[11px]">
              <Activity className="h-3 w-3 text-sky-500" /> Tool Execution Monitor ({logs.length})
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={clearLogs}
            >
              Clear Logs
            </Button>
          </div>

          {logs.length === 0 ? (
            <p className="text-[11px] text-muted-foreground py-2 text-center">
              No tools executed yet. Ask questions that read, update, or create files!
            </p>
          ) : (
            <div className="space-y-1.5">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-2 rounded-lg border border-border/40 bg-background/80 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-medium text-sky-400 text-[11px] flex items-center gap-1">
                      {log.status === "executing" && <Loader2 className="h-3 w-3 animate-spin text-amber-400" />}
                      {log.status === "success" && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                      {log.status === "error" && <AlertCircle className="h-3 w-3 text-red-500" />}
                      {log.toolName}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="text-[10px] font-mono text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded overflow-x-auto">
                    args: {JSON.stringify(log.args)}
                  </div>

                  {log.status === "success" && (
                    <div className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded overflow-x-auto">
                      result: {JSON.stringify(log.result)}
                    </div>
                  )}

                  {log.status === "error" && (
                    <div className="text-[10px] font-mono text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded overflow-x-auto">
                      error: {log.error}
                    </div>
                  )}
                </div>
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
                Powered by Rust <code className="text-sky-400 font-mono">rig-core</code> and local Ollama.
                Type <code className="text-sky-400 font-semibold">@</code> to mention files, review &amp; update markdown live.
              </p>
            </div>

            {/* Quick Test Prompt Chips */}
            <div className="w-full space-y-2 pt-2">
              <p className="text-[11px] font-medium text-muted-foreground text-left">Try example actions:</p>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => handleSend("Read active markdown and review its structure, grammar, and outline")}
                  className="text-left px-3 py-2 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/50 hover:border-sky-500/30 text-xs text-foreground transition-all cursor-pointer flex items-center justify-between group"
                >
                  <span>Review active document structure &amp; outline</span>
                  <span className="text-[10px] text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    read_markdown 🔍
                  </span>
                </button>

                <button
                  onClick={() => handleSend("Update the Conclusion section in active markdown with 3 key takeaways")}
                  className="text-left px-3 py-2 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/50 hover:border-sky-500/30 text-xs text-foreground transition-all cursor-pointer flex items-center justify-between group"
                >
                  <span>Update Conclusion section</span>
                  <span className="text-[10px] text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    update_markdown_section ✏️
                  </span>
                </button>

                <button
                  onClick={() => handleSend("Create a file named demo_notes.md with a detailed guide on PlantUML diagrams")}
                  className="text-left px-3 py-2 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/50 hover:border-sky-500/30 text-xs text-foreground transition-all cursor-pointer flex items-center justify-between group"
                >
                  <span>Create file &apos;demo_notes.md&apos;</span>
                  <span className="text-[10px] text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    create_file 📄
                  </span>
                </button>

                <button
                  onClick={() => handleSend("What is the age, country, and DOB of Alice Smith?")}
                  className="text-left px-3 py-2 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/50 hover:border-sky-500/30 text-xs text-foreground transition-all cursor-pointer flex items-center justify-between group"
                >
                  <span>Lookup user details for Alice Smith</span>
                  <span className="text-[10px] text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    Parallel tools ⚡
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-none"
                      : "bg-muted/60 border border-border/50 text-foreground rounded-bl-none"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                <span className="text-[9px] text-muted-foreground px-1 mt-1 font-mono">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}

            {isGenerating && (
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl rounded-bl-none bg-muted/60 border border-border/50 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-500" />
                  <span>
                    {activeToolCall
                      ? `Executing tool: ${activeToolCall.toolName}...`
                      : "Synthesizing response from Ollama..."}
                  </span>
                </div>
              </div>
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
            placeholder={isGenerating ? "Processing query..." : "Ask a query, edit markdown, or type @ to mention files..."}
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
