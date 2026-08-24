import React from "react";
import { ChatMessage } from "../store/LLMChat2Store";

export interface UserChatMessageProps {
  message: ChatMessage;
}

export const UserChatMessage: React.FC<UserChatMessageProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-end">
      <div className="max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed bg-primary text-primary-foreground rounded-br-none">
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
      <span className="text-[9px] text-muted-foreground px-1 mt-1 font-mono">
        {new Date(message.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
};
