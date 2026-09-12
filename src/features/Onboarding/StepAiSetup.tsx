import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { arch, platform } from "@tauri-apps/plugin-os";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Copy,
  Cpu,
  ExternalLink,
  LoaderCircle,
  Terminal,
} from "lucide-react";

import { Button } from "@/components/ui/button";

interface OllamaModelInfo {
  name: string;
}

interface SystemProfile {
  os: string;
  architecture: string;
  total_memory_bytes?: number;
}

interface RecommendedModel {
  id: string;
  label: string;
  reason: string;
}

type OllamaStatus = "checking" | "ready" | "unavailable";

function getTotalMemoryGiB(
  systemProfile: SystemProfile | null,
): number | undefined {
  if (systemProfile?.total_memory_bytes !== undefined) {
    return Math.round(systemProfile.total_memory_bytes / 1_073_741_824);
  }

  return (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
}

function getRecommendedModel(
  systemProfile: SystemProfile | null,
): RecommendedModel {
  const totalMemoryGiB = getTotalMemoryGiB(systemProfile);

  if (totalMemoryGiB !== undefined && totalMemoryGiB <= 4) {
    return {
      id: "qwen3.5:0.8b",
      label: "Qwen 3.5 0.8B",
      reason: "A lightweight option for systems with limited available memory.",
    };
  }

  if (totalMemoryGiB !== undefined && totalMemoryGiB <= 8) {
    return {
      id: "qwen3.5:2b",
      label: "Qwen 3.5 2B",
      reason: "A balanced pick for a lower-memory laptop.",
    };
  }

  const currentPlatform = systemProfile?.os ?? platform();
  const currentArchitecture = systemProfile?.architecture ?? arch();

  if (
    currentPlatform === "macos" &&
    (currentArchitecture === "aarch64" || currentArchitecture === "arm64")
  ) {
    return {
      id: "qwen3.5:4b-mlx",
      label: "Qwen 3.5 4B MLX",
      reason: "Optimized for Apple silicon and the best default on this Mac.",
    };
  }

  return {
    id: "qwen3.5:4b",
    label: "Qwen 3.5 4B",
    reason: "Our recommended general-purpose model for this system.",
  };
}

function getSystemLabel(systemProfile: SystemProfile | null): string {
  const currentPlatform = systemProfile?.os ?? platform();
  const currentArch = systemProfile?.architecture ?? arch();
  const platformLabel =
    currentPlatform === "macos"
      ? "macOS"
      : currentPlatform === "windows"
        ? "Windows"
        : "Linux";
  const architectureLabel =
    currentArch === "aarch64" ? "Apple silicon / ARM64" : currentArch;
  const totalMemoryGiB = getTotalMemoryGiB(systemProfile);

  return totalMemoryGiB === undefined
    ? `${platformLabel} · ${architectureLabel}`
    : `${platformLabel} · ${architectureLabel} · ${totalMemoryGiB} GB memory`;
}

function isInstalledModel(
  installedName: string,
  recommendedId: string,
): boolean {
  const normalizedInstalledName = installedName.toLowerCase();
  const normalizedRecommendedId = recommendedId.toLowerCase();

  return (
    normalizedInstalledName === normalizedRecommendedId ||
    normalizedInstalledName === `${normalizedRecommendedId}:latest`
  );
}

export function StepAiSetup({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: () => void;
}): JSX.Element {
  const [systemProfile, setSystemProfile] = useState<SystemProfile | null>(
    null,
  );
  const recommendedModel = useMemo(
    () => getRecommendedModel(systemProfile),
    [systemProfile],
  );
  const systemLabel = useMemo(
    () => getSystemLabel(systemProfile),
    [systemProfile],
  );
  const [status, setStatus] = useState<OllamaStatus>("checking");
  const [installedModels, setInstalledModels] = useState<OllamaModelInfo[]>([]);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    const checkOllama = async (): Promise<void> => {
      try {
        const profile = await invoke<SystemProfile>("llm2_get_system_profile");
        setSystemProfile(profile);
      } catch (error) {
        console.error(
          "Failed to read the system profile during onboarding:",
          error,
        );
      }

      try {
        const models = await invoke<OllamaModelInfo[]>("llm2_list_models");
        setInstalledModels(models);
        setStatus("ready");
      } catch (error) {
        console.error("Failed to check Ollama during onboarding:", error);
        setStatus("unavailable");
      }
    };

    void checkOllama();
  }, []);

  const installCommand =
    platform() === "windows"
      ? "irm https://ollama.com/install.ps1 | iex"
      : "curl -fsSL https://ollama.com/install.sh | sh";
  const pullCommand = `ollama pull ${recommendedModel.id}`;
  const hasRecommendedModel = installedModels.some((model) =>
    isInstalledModel(model.name, recommendedModel.id),
  );

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(`${installCommand}\n${pullCommand}`);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 2_000);
    } catch (error) {
      console.error("Failed to copy Ollama setup commands:", error);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between">
      <div className="space-y-5">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Cpu className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Recommended for your system
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {systemLabel}
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {recommendedModel.label}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {recommendedModel.reason}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Terminal className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Use Ollama locally
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Download a model once, then use Depdok’s AI assistant
                  privately on your computer.
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Qwen is the primary model family. <code>gemma4:e2b</code> is
                  also a tested alternative.
                </p>
              </div>
            </div>
            {status === "checking" && (
              <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            )}
            {status === "ready" && (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" /> Available
              </span>
            )}
            {status === "unavailable" && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                <CircleAlert className="h-3.5 w-3.5" /> Not running
              </span>
            )}
          </div>

          {hasRecommendedModel ? (
            <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
              {recommendedModel.label} is ready to use in Depdok.
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Run these commands in{" "}
                {platform() === "windows" ? "PowerShell" : "Terminal"}:
              </p>
              <pre className="overflow-x-auto rounded-lg bg-muted px-3 py-2.5 text-xs leading-6 text-foreground">
                <code>
                  {installCommand}\n{pullCommand}
                </code>
              </pre>
              <div className="flex items-center justify-between gap-3">
                <a
                  href="https://ollama.com/download"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Ollama download help <ExternalLink className="h-3 w-3" />
                </a>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleCopy()}
                  className="gap-1.5"
                >
                  {isCopied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {isCopied ? "Copied" : "Copy commands"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-dashed border-border px-4 py-3">
          <p className="text-sm font-medium text-foreground">
            Prefer a cloud provider?
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            OpenAI, Claude, and OpenRouter key setup is planned. This release’s
            chat engine currently supports local Ollama only.
          </p>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-border/80 pt-6">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </Button>
        <Button onClick={onNext} className="gap-2">
          <span>{hasRecommendedModel ? "Continue" : "Set up later"}</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
