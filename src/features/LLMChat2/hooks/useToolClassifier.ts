import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface ClassificationResult {
  label: string;
  toolset: "NONE" | "FILE" | "FOLDER" | "KNOWLEDGE" | "WEB" | "SHELL" | "SPREADSHEET" | "ALL";
  tools: string[];
  raw_output: string;
  latency_ms: number;
  estimated_tokens: number;
}

export interface UseToolClassifierReturn {
  label: string | null;
  tools: string[];
  isClassifying: boolean;
  latencyMs: number | null;
  estimatedTokens: number | null;
  rawOutput: string | null;
  error: string | null;
}

/**
 * Hook to classify user input into active toolsets with debouncing.
 * Calls `llm2_classify_intent` on the Tauri backend with layer toggle support.
 */
export function useToolClassifier(
  inputVal: string,
  model?: string,
  debounceMs: number = 500,
  enableCategories: boolean = true,
  enableFilter: boolean = true
): UseToolClassifierReturn {
  const [label, setLabel] = useState<string | null>(null);
  const [tools, setTools] = useState<string[]>([]);
  const [isClassifying, setIsClassifying] = useState<boolean>(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [estimatedTokens, setEstimatedTokens] = useState<number | null>(null);
  const [rawOutput, setRawOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeRequestIdRef = useRef<number>(0);

  useEffect(() => {
    const trimmed = inputVal.trim();

    if (!trimmed) {
      setLabel(null);
      setTools([]);
      setIsClassifying(false);
      setLatencyMs(null);
      setEstimatedTokens(null);
      setRawOutput(null);
      setError(null);
      return;
    }

    const currentRequestId = ++activeRequestIdRef.current;
    setIsClassifying(true);

    const timer = setTimeout(async () => {
      try {
        const result = await invoke<ClassificationResult>("llm2_classify_intent", {
          prompt: trimmed,
          model: model || undefined,
          enableCategories,
          enable_categories: enableCategories,
          enableFilter,
          enable_filter: enableFilter,
        });

        // Ensure we only update state if this is the most recent request
        if (currentRequestId === activeRequestIdRef.current) {
          setLabel(result.label);
          setTools(result.tools || []);
          setLatencyMs(result.latency_ms);
          setEstimatedTokens(result.estimated_tokens || null);
          setRawOutput(result.raw_output);
          setError(null);
          setIsClassifying(false);
        }
      } catch (err) {
        if (currentRequestId === activeRequestIdRef.current) {
          console.error("[useToolClassifier] Classification error:", err);
          setError(String(err));
          setIsClassifying(false);
        }
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [inputVal, model, debounceMs, enableCategories, enableFilter]);

  return {
    label,
    tools,
    isClassifying,
    latencyMs,
    estimatedTokens,
    rawOutput,
    error,
  };
}
