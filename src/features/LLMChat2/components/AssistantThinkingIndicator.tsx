import React, { useMemo } from "react";
import { OrbState, ThinkingOrb } from "thinking-orbs";

import { ToolExecutionLog } from "../store/LLMChat2Store";

export interface AssistantThinkingIndicatorProps {
  isGenerating?: boolean;
  activeToolCall?: ToolExecutionLog | null;
  className?: string;
  defaultText?: string;
}

function resolveOrbState(toolName?: string): OrbState {
  if (!toolName) {
    return "composing";
  }

  const lower = toolName.toLowerCase();
  if (
    lower.includes("search") ||
    lower.includes("find") ||
    lower.includes("grep") ||
    lower.includes("query")
  ) {
    return "searching";
  }

  if (
    lower.includes("read") ||
    lower.includes("list") ||
    lower.includes("get") ||
    lower.includes("fetch")
  ) {
    return "listening";
  }

  if (
    lower.includes("write") ||
    lower.includes("create") ||
    lower.includes("replace") ||
    lower.includes("patch") ||
    lower.includes("edit")
  ) {
    return "shaping";
  }

  if (lower.includes("mcp") || lower.includes("connect")) {
    return "connecting";
  }

  return "working";
}

export const AssistantThinkingIndicator: React.FC<AssistantThinkingIndicatorProps> = ({
  isGenerating = false,
  activeToolCall = null,
  className = "",
  defaultText = "Synthesizing response from Ollama...",
}) => {
  const orbState = useMemo(() => {
    return resolveOrbState(activeToolCall?.toolName);
  }, [activeToolCall?.toolName]);

  const statusText = useMemo(() => {
    if (activeToolCall?.toolName) {
      return `Executing ${activeToolCall.toolName}...`;
    }
    return defaultText;
  }, [activeToolCall?.toolName, defaultText]);

  if (!isGenerating) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 text-muted-foreground py-0.5 ${className}`.trim()}>
      <ThinkingOrb size={20} state={orbState} />
      <span className="text-[11px] select-none">{statusText}</span>
    </div>
  );
};
