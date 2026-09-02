import React, { useRef, useEffect } from "react";
import {
  Plus,
  Sparkles,
  ArrowUp,
  Square,
  FileText,
  Database,
  PenTool,
  AtSign,
  FolderTree,
  Globe,
  Brain,
} from "lucide-react";
import { useAtom } from "jotai";
import { cn } from "@/lib/utils";
import { chat2WebSearchEnabledAtom, chat2ThinkingEnabledAtom } from "../store/LLMChat2Store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModelSelector } from "./ModelSelector";

export interface LLMChat2InputProps {
  inputVal: string;
  setInputVal: (val: string) => void;
  isGenerating: boolean;
  onSend: (customPrompt?: string) => void;
  onStop?: () => void;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export const LLMChat2Input: React.FC<LLMChat2InputProps> = ({
  inputVal,
  setInputVal,
  isGenerating,
  onSend,
  onStop,
  inputRef,
  onInputChange,
  onKeyDown,
}) => {
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useAtom(chat2WebSearchEnabledAtom);
  const [isThinkingEnabled, setIsThinkingEnabled] = useAtom(chat2ThinkingEnabledAtom);
  const localRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef || localRef;

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const nextHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 38), 160);
      textareaRef.current.style.height = `${nextHeight}px`;
    }
  }, [inputVal, textareaRef]);

  const handleInsertPrompt = (prompt: string) => {
    setInputVal(prompt);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const endPos = prompt.length;
        textareaRef.current.setSelectionRange(endPos, endPos);
      }
    }, 10);
  };

  const handleInsertMentionTrigger = () => {
    const current = inputVal;
    const nextVal = current ? (current.endsWith(" ") ? `${current}@` : `${current} @`) : "@";
    setInputVal(nextVal);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const endPos = nextVal.length;
        textareaRef.current.setSelectionRange(endPos, endPos);
      }
    }, 10);
  };

  const handleInsertSlashTrigger = () => {
    const current = inputVal;
    const nextVal = current ? (current.endsWith(" ") ? `${current}/` : `${current} /`) : "/";
    setInputVal(nextVal);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const endPos = nextVal.length;
        textareaRef.current.setSelectionRange(endPos, endPos);
      }
    }, 10);
  };

  return (
    <div className="relative flex flex-col bg-background/95 border border-border/80 rounded-2xl p-2.5 shadow-xs focus-within:border-ring/70 focus-within:ring-1 focus-within:ring-ring/20 transition-all">
      {/* Top Input Area */}
      <textarea
        ref={textareaRef}
        rows={1}
        value={inputVal}
        onChange={onInputChange}
        onKeyDown={onKeyDown}
        placeholder={
          isGenerating
            ? "Streaming response from Ollama... Click Stop or press Esc to cancel"
            : "Ask a query, type / for skills/commands, or @ for files & folders..."
        }
        disabled={isGenerating}
        className="w-full bg-transparent border-0 outline-none text-xs text-foreground placeholder:text-muted-foreground/60 resize-none min-h-[38px] max-h-[160px] p-1 focus:outline-none focus:ring-0 leading-relaxed disabled:opacity-50 select-text"
      />

      {/* Bottom Action Bar */}
      <div className="chat2-input-action-bar flex items-center justify-between gap-2 pt-2 select-none">
        {/* Left Side: + Action Menu and Web Search/Thinking Icon Toggles */}
        <div className="chat2-input-actions-left flex items-center gap-1.5 min-w-0">
          {/* + Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="chat2-input-action-btn h-7 w-7 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Add attachment or action"
              >
                <Plus className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} className="w-56 p-1 rounded-xl">
              <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase font-semibold px-2 py-1">
                Attach &amp; Actions
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={handleInsertSlashTrigger}
                className="text-xs flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>Commands &amp; Skills (/)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleInsertMentionTrigger}
                className="text-xs flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5"
              >
                <AtSign className="h-3.5 w-3.5 text-primary" />
                <span>Mention file or folder (@)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  handleInsertPrompt(
                    "Read active markdown document and review its outline & structure"
                  )
                }
                className="text-xs flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5"
              >
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span>Read active document</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleInsertPrompt("Search knowledge base for ")}
                className="text-xs flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5"
              >
                <Database className="h-3.5 w-3.5 text-primary" />
                <span>Search knowledge base</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  handleInsertPrompt("Draft a comprehensive article about ")
                }
                className="text-xs flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5"
              >
                <PenTool className="h-3.5 w-3.5 text-primary" />
                <span>Generate rich content</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  handleInsertPrompt("List the files and directories in the workspace")
                }
                className="text-xs flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5"
              >
                <FolderTree className="h-3.5 w-3.5 text-primary" />
                <span>Inspect workspace tree</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Web Search Icon Toggle Button */}
          <button
            type="button"
            onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
            className={cn(
              "chat2-input-action-btn h-7 w-7 rounded-xl border flex items-center justify-center transition-all cursor-pointer shrink-0 select-none",
              isWebSearchEnabled
                ? "bg-primary/10 border-primary/30 text-primary shadow-xs hover:bg-primary/15"
                : "border-border/60 bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
            title={
              isWebSearchEnabled
                ? "Web Search: ON (AI will search the web when needed)"
                : "Web Search: OFF (click to enable web browsing)"
            }
          >
            <Globe
              className={cn(
                "h-4 w-4 shrink-0 transition-transform",
                isWebSearchEnabled ? "text-primary scale-105" : "text-muted-foreground"
              )}
            />
          </button>

          {/* Thinking / Reasoning Icon Toggle Button */}
          <button
            type="button"
            onClick={() => setIsThinkingEnabled(!isThinkingEnabled)}
            className={cn(
              "chat2-input-action-btn h-7 w-7 rounded-xl border flex items-center justify-center transition-all cursor-pointer shrink-0 select-none",
              isThinkingEnabled
                ? "bg-primary/10 border-primary/30 text-primary shadow-xs hover:bg-primary/15"
                : "border-border/60 bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
            title={
              isThinkingEnabled
                ? "Deep Thinking: ON (Model will output reasoning trace)"
                : "Deep Thinking: OFF (click to disable reasoning)"
            }
          >
            <Brain
              className={cn(
                "h-4 w-4 shrink-0 transition-transform",
                isThinkingEnabled ? "text-primary scale-105" : "text-muted-foreground"
              )}
            />
          </button>
        </div>

        {/* Right Side: Model Selector & Send / Stop Button */}
        <div className="chat2-input-actions-right flex items-center gap-1.5 shrink-0">
          {/* Inline Compact Model Selector */}
          <ModelSelector />

          {/* Send Up-Arrow or Stop Square Button */}
          {isGenerating ? (
            <button
              type="button"
              onClick={onStop}
              className="chat2-send-btn h-7 w-7 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0 animate-in fade-in zoom-in-90 duration-150"
              title="Stop generation (Esc)"
            >
              <Square className="h-3 w-3 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSend()}
              disabled={!inputVal.trim()}
              className="chat2-send-btn h-7 w-7 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground/40 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0"
              title="Send prompt (Enter)"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
