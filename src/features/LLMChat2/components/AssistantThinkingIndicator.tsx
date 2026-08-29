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
}

const MODEL_LOADING_PHRASES = [
  "Ollama is loading {model} model into memory...",
  "Warming up model weights from disk...",
  "Allocating context memory buffers...",
  "Initializing neural graph & layers...",
  "Almost ready, finalizing load...",
];

const SYNTHESIZING_PHRASES = [
  "Synthesizing response from Ollama...",
  "Pondering the solution...",
  "Analyzing context & instructions...",
  "Reasoning through options...",
  "Connecting thoughts...",
  "Formulating answer...",
  "Deliberating next steps...",
  "Drafting response...",
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
  defaultText = "Synthesizing response from Ollama...",
  generationStatus: propStatus,
}) => {
  const storeStatus = useAtomValue(chat2GenerationStatusAtom);
  const status = propStatus || storeStatus;

  const [phraseIndex, setPhraseIndex] = useState(0);
  const [fadeState, setFadeState] = useState<"visible" | "fading">("visible");

  const isToolExecuting = Boolean(activeToolCall);

  // Cycle phrases every 1.5s (1500ms) while generating
  useEffect(() => {
    if (!isGenerating || isToolExecuting) {
      setPhraseIndex(0);
      setFadeState("visible");
      return;
    }

    const interval = setInterval(() => {
      setFadeState("fading");
      setTimeout(() => {
        setPhraseIndex((prev) => prev + 1);
        setFadeState("visible");
      }, 200);
    }, 3000);

    return () => clearInterval(interval);
  }, [isGenerating, isToolExecuting]);

  const orbState = useMemo(() => {
    return resolveOrbState(activeToolCall?.toolName, status.phase);
  }, [activeToolCall?.toolName, status.phase]);

  const displayText = useMemo(() => {
    if (activeToolCall?.toolName) {
      return `Executing ${activeToolCall.toolName}...`;
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

  if (!isGenerating) {
    return null;
  }

  return (
    <div
      className={`flex items-center gap-2 text-muted-foreground py-0.5 ${className}`.trim()}
    >
      <ThinkingOrb size={20} state={orbState} />
      <span
        className={`text-[11px] select-none transition-opacity duration-150 ${fadeState === "fading" ? "opacity-30" : "opacity-100"
          } ${status.phase === "loading_model" ? "text-amber-500/90 font-medium" : ""}`}
      >
        {displayText}
      </span>
    </div>
  );
};
