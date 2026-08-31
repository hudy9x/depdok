import React, { useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { OrbState, ThinkingOrb } from "thinking-orbs";

import {
  chat2GenerationStatusAtom,
  GenerationStatus,
  ToolExecutionLog,
} from "../store/LLMChat2Store";

export interface AssistantThinkingIndicatorProps {
  isGenerating?: boolean;
  activeToolCall?: ToolExecutionLog | null;
  className?: string;
  defaultText?: string;
  generationStatus?: GenerationStatus;
  hasStreamedContent?: boolean;
}

const SYNTHESIZING_PHRASES = [
  "Synthesizing response from Ollama",
  "Reasoning through options",
  "Analyzing context & instructions",
  "Connecting ideas & knowledge",
  "Formulating solution",
  "Drafting response",
  "Deliberating next steps",
  "Synthesizing findings",
];

const MODEL_LOADING_PHRASES = [
  "Ollama is loading {model} into memory",
  "Warming up model layers",
  "Allocating memory buffers",
  "Initializing model graph",
];

function resolveOrbState(toolName?: string, phase?: string): OrbState {
  if (toolName) {
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

  if (phase === "loading_model") {
    return "working";
  }

  return "composing";
}

export const AssistantThinkingIndicator: React.FC<AssistantThinkingIndicatorProps> = ({
  isGenerating = false,
  activeToolCall = null,
  className = "",
  defaultText = "Synthesizing response from Ollama",
  generationStatus: propStatus,
  hasStreamedContent = false,
}) => {
  const storeStatus = useAtomValue(chat2GenerationStatusAtom);
  const status = propStatus || storeStatus;

  const [phraseIndex, setPhraseIndex] = useState(0);

  const isToolExecuting = Boolean(activeToolCall);

  // Cycle phrases smoothly every 2.4s while generating
  useEffect(() => {
    if (!isGenerating || isToolExecuting) {
      setPhraseIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setPhraseIndex((prev) => prev + 1);
    }, 2400);

    return () => clearInterval(interval);
  }, [isGenerating, isToolExecuting]);

  const orbState = useMemo(() => {
    return resolveOrbState(activeToolCall?.toolName, status.phase);
  }, [activeToolCall?.toolName, status.phase]);

  const displayText = useMemo(() => {
    if (activeToolCall?.toolName) {
      return `Executing ${activeToolCall.toolName}`;
    }

    if (status.phase === "loading_model") {
      const modelName = status.model || "model";
      const template =
        MODEL_LOADING_PHRASES[phraseIndex % MODEL_LOADING_PHRASES.length];
      return template.replace("{model}", modelName);
    }

    if (status.phase === "synthesizing" || isGenerating) {
      return SYNTHESIZING_PHRASES[phraseIndex % SYNTHESIZING_PHRASES.length];
    }

    return defaultText;
  }, [activeToolCall?.toolName, status.phase, status.model, phraseIndex, isGenerating, defaultText]);

  // Hide the indicator if not generating, or if model has started streaming content/thoughts and no tool is executing
  if (!isGenerating || (hasStreamedContent && !activeToolCall)) {
    return null;
  }

  const isLoadingModel = status.phase === "loading_model";

  return (
    <div
      className={`flex items-center gap-2 text-muted-foreground py-0.5 select-none isolate ${className}`.trim()}
    >
      <div className="shrink-0 flex items-center justify-center">
        <ThinkingOrb size={20} state={orbState} />
      </div>

      <div className="flex items-center gap-1 min-w-0 overflow-hidden">
        <span
          key={displayText}
          className={`text-[11px] font-sans truncate animate-in fade-in slide-in-from-bottom-0.5 duration-200 inline-block ${
            isLoadingModel
              ? "text-amber-500/90 font-medium"
              : "text-muted-foreground/85"
          }`}
        >
          {displayText}
        </span>

        {/* Dynamic pulsing ellipsis animation to show active processing */}
        <span className="flex items-center text-[11px] tracking-widest text-muted-foreground/70 font-mono select-none">
          <span className="animate-pulse duration-700">.</span>
          <span className="animate-pulse duration-700 delay-150">.</span>
          <span className="animate-pulse duration-700 delay-300">.</span>
        </span>
      </div>
    </div>
  );
};
