import { useCallback, useEffect, useRef } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Bot, X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { workspaceRootAtom } from "@/features/FileExplorer/store";

import { sendChatMessage, cancelGeneration } from "../api/llm";
import type { ChatMessage } from "../api/llm";
import {
  isChatOpenAtom,
  chatMessagesAtom,
  isGeneratingAtom,
  activeToolCallAtom,
  currentSessionIdAtom,
  llmProviderStatusAtom,
  generateSessionId,
  taggedFilesAtom,
} from "../store/LLMChatStore";
import { useLlmStream } from "../hooks/useLlmStream";
import { LLMChatMessage } from "./LLMChatMessage";
import { LLMChatInput } from "./LLMChatInput";
import { buildPromptPayload } from "../lib/promptBuilder";

export function LLMChatPanel() {
  const [isChatOpen, setIsChatOpen] = useAtom(isChatOpenAtom);
  const [messages, setMessages] = useAtom(chatMessagesAtom);
  const [isGenerating, setIsGenerating] = useAtom(isGeneratingAtom);
  const activeToolCall = useAtomValue(activeToolCallAtom);
  const [sessionId, setSessionId] = useAtom(currentSessionIdAtom);
  const providerStatus = useAtomValue(llmProviderStatusAtom);
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const [taggedFiles, setTaggedFiles] = useAtom(taggedFilesAtom);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mount streaming lifecycle hooks
  useLlmStream();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!workspaceRoot) {
        toast.warning("Please open a workspace first.");
        return;
      }

      // Read all tagged files
      const currentTags = [...taggedFiles];
      const attachedFilesMeta = currentTags.map((f) => ({ name: f.name, path: f.path }));
      
      const reinforcedText = await buildPromptPayload(text, currentTags);

      // Save UI user message (clean text but with attachedFiles metadata)
      const userMsg: ChatMessage = {
        role: "user",
        content: reinforcedText,
        attachedFiles: attachedFilesMeta,
      };
      
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setIsGenerating(true);
      setTaggedFiles([]); // Clear tag pills in UI

      try {
        await sendChatMessage(newMessages, workspaceRoot, sessionId);
      } catch (err) {
        setIsGenerating(false);
        toast.error(`Failed to send message: ${String(err)}`);
      }
    },
    [messages, setMessages, setIsGenerating, workspaceRoot, sessionId, taggedFiles, setTaggedFiles],
  );

  const handleStop = useCallback(async () => {
    try {
      await cancelGeneration();
    } catch (err) {
      console.error("Failed to cancel generation:", err);
    }
    setIsGenerating(false);
  }, [setIsGenerating]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setSessionId(generateSessionId());
    setIsGenerating(false);
    setTaggedFiles([]);
  }, [setMessages, setSessionId, setIsGenerating, setTaggedFiles]);

  const handleClearMessages = useCallback(() => {
    setMessages([]);
  }, [setMessages]);

  if (!isChatOpen) return null;

  const modelLabel =
    providerStatus?.model_name ??
    (providerStatus?.provider_type === "local" ? "No model" : providerStatus?.provider_type);

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col w-[520px] h-[720px] max-h-[calc(100vh-32px)] rounded-2xl border border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden"
      style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 shrink-0 bg-muted/20">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 border border-primary/20">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">AI Assistant</p>
          {modelLabel && (
            <p className="text-[10px] text-muted-foreground truncate">{modelLabel}</p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={handleNewChat}
            title="New chat session"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={handleClearMessages}
            title="Clear messages"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => setIsChatOpen(false)}
            title="Close chat"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-2 scrollbar-hide">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">AI Assistant</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ask me anything about your codebase. I can read files, run commands, and search the web.
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              const isLast = i === messages.length - 1;
              const isStreamingThis = isLast && msg.role === "assistant" && isGenerating;
              return (
                <LLMChatMessage
                  key={i}
                  message={msg}
                  isStreaming={isStreamingThis}
                  activeToolCall={isStreamingThis ? activeToolCall : null}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <LLMChatInput
        onSend={handleSend}
        onStop={handleStop}
        isGenerating={isGenerating}
        disabled={!workspaceRoot}
      />
    </div>
  );
}
