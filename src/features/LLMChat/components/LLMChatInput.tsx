import { useCallback, useRef, useState, KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LLMChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isGenerating: boolean;
  disabled?: boolean;
}

export function LLMChatInput({ onSend, onStop, isGenerating, disabled }: LLMChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const text = value.trim();
    if (!text || isGenerating) return;
    onSend(text);
    setValue("");
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, isGenerating, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  return (
    <div className="border-t border-border/60 p-3">
      <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 focus-within:border-primary/50 transition-colors">
        <textarea
          ref={textareaRef}
          className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-h-[36px] max-h-[160px] overflow-y-auto leading-relaxed"
          placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled}
          rows={1}
        />
        <div className="shrink-0 pb-0.5">
          {isGenerating ? (
            <Button
              size="icon"
              variant="destructive"
              className="h-7 w-7 rounded-lg cursor-pointer"
              onClick={onStop}
              title="Stop generation"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="h-7 w-7 rounded-lg cursor-pointer"
              onClick={handleSend}
              disabled={!value.trim() || disabled}
              title="Send message"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground/60 mt-1.5 px-1">
        Tools: read_file · write_file · list_directory · run_shell · web_search
      </p>
    </div>
  );
}
