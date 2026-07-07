import { useCallback, useEffect } from "react";
import { useAtom, useSetAtom } from "jotai";
import { toast } from "sonner";

import { getLlmConfig, saveLlmConfig, loadLlmProvider, getLlmProviderStatus } from "../api/llm";
import type { LlmConfig } from "../api/llm";
import { llmConfigAtom, llmProviderStatusAtom } from "../store/LLMChatStore";

/**
 * Hook for loading, saving, and reloading the LLM provider configuration.
 * Automatically loads config on first call.
 */
export function useLlmConfig() {
  const [config, setConfig] = useAtom(llmConfigAtom);
  const setStatus = useSetAtom(llmProviderStatusAtom);

  // Load config from backend on mount
  useEffect(() => {
    let active = true;
    getLlmConfig()
      .then((c) => { if (active) setConfig(c); })
      .catch(console.error);
    getLlmProviderStatus()
      .then((s) => { if (active) setStatus(s); })
      .catch(console.error);
    return () => { active = false; };
  }, [setConfig, setStatus]);

  const saveAndLoad = useCallback(
    async (newConfig: LlmConfig) => {
      try {
        await saveLlmConfig(newConfig);
        setConfig(newConfig);

        // Only load provider for local — remote providers need no pre-loading
        if (newConfig.provider_type === "local") {
          await loadLlmProvider();
          toast.success("Model loaded successfully");
        } else {
          toast.success("Provider configuration saved");
        }

        // Refresh status
        const status = await getLlmProviderStatus();
        setStatus(status);
      } catch (err) {
        console.error("Failed to save LLM config:", err);
        toast.error(`Failed to configure provider: ${String(err)}`);
        throw err;
      }
    },
    [setConfig, setStatus],
  );

  const refreshStatus = useCallback(async () => {
    try {
      const status = await getLlmProviderStatus();
      setStatus(status);
    } catch (err) {
      console.error("Failed to refresh provider status:", err);
    }
  }, [setStatus]);

  return { config, saveAndLoad, refreshStatus };
}
