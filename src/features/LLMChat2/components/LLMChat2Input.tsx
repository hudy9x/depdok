import React, { useRef, useEffect } from "react";
import {
  Plus,
  Sparkles,
  ArrowUp,
  Loader2,
  ChevronDown,
  FileText,
  Database,
  PenTool,
  AtSign,
  FolderTree,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModelSelector } from "./ModelSelector";

export interface LLMChat2InputProps {
  inputVal: string;
  setInputVal: (val: string) => void;
  isGenerating: boolean;
  onSend: (customPrompt?: string) => void;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

interface InspirationOption {
  label: string;
  category: string;
  prompt: string;
}

const INSPIRATION_PROMPTS: InspirationOption[] = [
  {
    category: "Knowledge Base",
    label: "Search documentation",
    prompt: "Search the knowledge base for information about ",
  },
  {
    category: "Knowledge Base",
    label: "Search vector embeddings",
    prompt: "Search the knowledge base for how vector embeddings and sqlite-vec work",
  },
  {
    category: "Markdown Editing",
    label: "Review active document",
    prompt: "Read active markdown and review its structure, outline, and grammar",
  },
  {
    category: "Markdown Editing",
    label: "Add Conclusion section",
    prompt: "Add a Conclusion section to active markdown with 3 key takeaways",
  },
  {
    category: "Markdown Editing",
    label: "Add inline review comment",
    prompt: "Add an inline review comment on the first heading in active markdown suggesting improvements",
  },
  {
    category: "Prose & Writing",
    label: "Draft tutorial article",
    prompt: "Draft a comprehensive, engaging markdown tutorial on ",
  },
  {
    category: "File Management",
    label: "List workspace files",
    prompt: "List the files and directory structure in the current workspace",
  },
];

export const LLMChat2Input: React.FC<LLMChat2InputProps> = ({
  inputVal,
  setInputVal,
  isGenerating,
  onSend,
  inputRef,
  onInputChange,
  onKeyDown,
}) => {
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

  const handleSelectInspiration = (prompt: string) => {
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
            ? "Streaming response from Ollama..."
            : "Ask a query, edit markdown, or type @ to mention files..."
        }
        disabled={isGenerating}
        className="w-full bg-transparent border-0 outline-none text-xs text-foreground placeholder:text-muted-foreground/60 resize-none min-h-[38px] max-h-[160px] p-1 focus:outline-none focus:ring-0 leading-relaxed disabled:opacity-50 select-text"
      />

      {/* Bottom Action Bar */}
      <div className="flex items-center justify-between gap-2 pt-2 select-none">
        {/* Left Side: + Action Menu and Inspiration Pill */}
        <div className="flex items-center gap-1.5 min-w-0">
          {/* + Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-7 w-7 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
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
                onClick={handleInsertMentionTrigger}
                className="text-xs flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5"
              >
                <AtSign className="h-3.5 w-3.5 text-primary" />
                <span>Mention file (@)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  handleSelectInspiration(
                    "Read active markdown document and review its outline & structure"
                  )
                }
                className="text-xs flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5"
              >
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span>Read active document</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleSelectInspiration("Search knowledge base for ")}
                className="text-xs flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5"
              >
                <Database className="h-3.5 w-3.5 text-primary" />
                <span>Search knowledge base</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  handleSelectInspiration("Draft a comprehensive article about ")
                }
                className="text-xs flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5"
              >
                <PenTool className="h-3.5 w-3.5 text-primary" />
                <span>Generate rich content</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  handleSelectInspiration("List the files and directories in the workspace")
                }
                className="text-xs flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5"
              >
                <FolderTree className="h-3.5 w-3.5 text-primary" />
                <span>Inspect workspace tree</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Inspiration Pill Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-7 px-2.5 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted text-foreground flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-[11px]">Inspiration</span>
                <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={6}
              className="w-72 max-h-72 overflow-y-auto p-1.5 rounded-xl space-y-1"
            >
              <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase font-semibold px-2 py-0.5">
                Quick Prompts
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuGroup>
                {INSPIRATION_PROMPTS.map((item, idx) => (
                  <DropdownMenuItem
                    key={idx}
                    onClick={() => handleSelectInspiration(item.prompt)}
                    className="flex flex-col items-start px-2 py-1.5 rounded-lg cursor-pointer hover:bg-muted/80"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-medium text-foreground">{item.label}</span>
                      <span className="text-[9px] text-muted-foreground font-mono">
                        {item.category}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/80 truncate w-full text-left mt-0.5">
                      {item.prompt}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right Side: Model Selector & Send Arrow Button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Inline Compact Model Selector */}
          <div className="scale-95 origin-right">
            <ModelSelector />
          </div>

          {/* Send Up-Arrow Button */}
          <button
            type="button"
            onClick={() => onSend()}
            disabled={!inputVal.trim() || isGenerating}
            className="h-7 w-7 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground/40 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0"
            title="Send prompt (Enter)"
          >
            {isGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
