import React from "react";
import { Info, CheckCircle2, AlertTriangle, AlertCircle, Terminal } from "lucide-react";
import { ChatMessage } from "../store/LLMChat2Store";

export interface SystemChatMessageProps {
  message: ChatMessage;
}

function getSystemIcon(content: string) {
  if (content.includes("❌") || content.toLowerCase().includes("failed") || content.toLowerCase().includes("error")) {
    return <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />;
  }
  if (content.includes("⚠️") || content.toLowerCase().includes("warning")) {
    return <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
  }
  if (content.includes("🔄") || content.includes("✨") || content.includes("✅") || content.toLowerCase().includes("success") || content.toLowerCase().includes("reloaded") || content.toLowerCase().includes("initialized")) {
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
  }
  if (content.startsWith("/")) {
    return <Terminal className="h-3.5 w-3.5 text-sky-400 shrink-0" />;
  }
  return <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

export const SystemChatMessage: React.FC<SystemChatMessageProps> = ({ message }) => {
  const icon = getSystemIcon(message.content);

  return (
    <div className="flex flex-col items-center justify-center w-full my-1 select-text">
      <div className="max-w-[95%] flex items-start gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border/50 text-xs text-foreground shadow-2xs backdrop-blur-xs">
        <div className="mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0 leading-relaxed whitespace-pre-wrap select-text font-normal">
          {message.content}
        </div>
      </div>
      <span className="text-[9px] text-muted-foreground/60 px-1 mt-0.5 font-mono">
        {new Date(message.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
};
