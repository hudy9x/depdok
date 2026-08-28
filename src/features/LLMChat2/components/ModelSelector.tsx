import { useEffect, useState, useCallback } from "react";
import { useAtom } from "jotai";
import { invoke } from "@tauri-apps/api/core";
import { Sparkles, RefreshCw, Layers, ChevronDown, Check, PenTool, Bot } from "lucide-react";
import {
  Qwen,
  Gemma,
  Meta,
  DeepSeek,
  Mistral,
  OpenAI,
  Claude,
  Gemini,
  Ollama,
  Yi,
  Minimax,
} from "@lobehub/icons";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { chat2ModelAtom, chat2ContentModelAtom } from "../store/LLMChat2Store";

interface OllamaModelInfo {
  name: string;
  size?: number;
  parameter_size?: string;
  quantization_level?: string;
}

interface FeaturedModel {
  id: string;
  displayName: string;
  badge: string;
  badgeColor: string;
  summary: string;
  details: string;
}

const FEATURED_MAIN_MODELS: FeaturedModel[] = [
  {
    id: "qwen3.5:9b",
    displayName: "Qwen 3.5 9B",
    badge: "Best Quality",
    badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    summary: "Top reasoning (thinking mode), Vietnamese/Japanese, vision & 256K ctx",
    details: "~6.6GB RAM • High tool precision",
  },
  {
    id: "qwen3.5:4b",
    displayName: "Qwen 3.5 4B",
    badge: "Fastest CPU",
    badgeColor: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    summary: "Ultra fast generation on CPU, lightweight, great tools & multilingual",
    details: "~3.4GB RAM • Outperforms 2.5:7B",
  },
  {
    id: "qwen2.5:7b",
    displayName: "Qwen 2.5 7B",
    badge: "Current Baseline",
    badgeColor: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    summary: "Standard text & tool model (shorter context, no thinking mode)",
    details: "~4.7GB RAM • Text only",
  },
];

const FEATURED_CONTENT_MODELS: FeaturedModel[] = [
  {
    id: "gemma2:9b",
    displayName: "Gemma 2 9B",
    badge: "Best Prose",
    badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    summary: "Google's premier creative writer, exceptional markdown flow & prose quality",
    details: "~5.4GB RAM • Dual-model writing specialist",
  },
  {
    id: "llama3.1:8b",
    displayName: "Llama 3.1 8B",
    badge: "Fast & 128k Ctx",
    badgeColor: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    summary: "Meta's flagship versatile model, massive context & crisp technical tutorials",
    details: "~4.7GB RAM • 128k context support",
  },
  {
    id: "llama3.2:3b",
    displayName: "Llama 3.2 3B",
    badge: "Ultra Fast",
    badgeColor: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    summary: "High-speed generation on CPU, lightweight yet punchy structured markdown",
    details: "~2.0GB RAM • Meta lightweight",
  },
  {
    id: "gemma2:2b",
    displayName: "Gemma 2 2B",
    badge: "Compact Gemma",
    badgeColor: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    summary: "Fast, memory-efficient writer for laptops and low-resource devices",
    details: "~1.6GB RAM • Low resource footprint",
  },
];

function renderModelAvatar(name: string, size = 14) {
  const lower = name.toLowerCase();
  if (lower.includes("qwen")) {
    return <Qwen.Avatar size={size} className="shrink-0" />;
  }
  if (lower.includes("gemma")) {
    return <Gemma.Avatar size={size} className="shrink-0" />;
  }
  if (lower.includes("llama") || lower.includes("meta")) {
    return <Meta.Avatar size={size} className="shrink-0" />;
  }
  if (lower.includes("deepseek")) {
    return <DeepSeek.Avatar size={size} className="shrink-0" />;
  }
  if (lower.includes("mistral") || lower.includes("mixtral") || lower.includes("codestral")) {
    return <Mistral.Avatar size={size} className="shrink-0" />;
  }
  if (lower.includes("gpt") || lower.includes("openai") || lower.includes("o1") || lower.includes("o3") || lower.includes("o4")) {
    return <OpenAI.Avatar size={size} className="shrink-0" />;
  }
  if (lower.includes("claude") || lower.includes("anthropic")) {
    return <Claude.Avatar size={size} className="shrink-0" />;
  }
  if (lower.includes("gemini")) {
    return <Gemini.Avatar size={size} className="shrink-0" />;
  }
  if (lower.includes("yi")) {
    return <Yi.Avatar size={size} className="shrink-0" />;
  }
  if (lower.includes("minimax")) {
    return <Minimax.Avatar size={size} className="shrink-0" />;
  }
  return <Ollama.Avatar size={size} className="shrink-0" />;
}

export function ModelSelector() {
  const [model, setModel] = useAtom(chat2ModelAtom);
  const [contentModel, setContentModel] = useAtom(chat2ContentModelAtom);
  const [installedModels, setInstalledModels] = useState<OllamaModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"main" | "content">("main");

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await invoke<OllamaModelInfo[]>("llm2_list_models");
      setInstalledModels(list || []);
    } catch {
      setInstalledModels([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const isMatchingModel = useCallback((installedName: string, targetId: string) => {
    const normInstalled = installedName.toLowerCase();
    const normTarget = targetId.toLowerCase();
    if (normInstalled === normTarget) return true;
    if (normInstalled === `${normTarget}:latest`) return true;
    if (normTarget === `${normInstalled}:latest`) return true;
    return false;
  }, []);

  const currentFeaturedList = activeTab === "main" ? FEATURED_MAIN_MODELS : FEATURED_CONTENT_MODELS;
  const currentActiveModel = activeTab === "main" ? model : contentModel;

  const installedFeatured = currentFeaturedList.filter((fm) =>
    installedModels.some((m) => isMatchingModel(m.name, fm.id))
  );

  const matchedInstalledNames = new Set(
    installedModels
      .filter((m) => installedFeatured.some((fm) => isMatchingModel(m.name, fm.id)))
      .map((m) => m.name.toLowerCase())
  );

  const otherDownloadedModels = installedModels.filter(
    (m) => !matchedInstalledNames.has(m.name.toLowerCase())
  );

  const mainFeatured = FEATURED_MAIN_MODELS.find((m) => isMatchingModel(model, m.id));
  const mainDisplayName = mainFeatured?.displayName || model;

  const contentFeatured = FEATURED_CONTENT_MODELS.find(
    (m) => isMatchingModel(contentModel, m.id)
  );
  const contentDisplayName = contentFeatured?.displayName || contentModel;

  const handleSelectModel = (selectedModelId: string) => {
    if (activeTab === "main") {
      setModel(selectedModelId);
    } else {
      setContentModel(selectedModelId);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="chat2-model-selector-btn h-6 w-auto flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/40 hover:bg-muted/70 border border-border/50 text-[11px] font-mono text-foreground transition-colors cursor-pointer select-none"
          title={`Active Models: Main (${mainDisplayName}) | Content Writer (${contentDisplayName})`}
        >
          <div className="chat2-model-main flex items-center gap-1">
            {renderModelAvatar(model, 13)}
            <span className="chat2-model-main-label font-medium truncate max-w-[95px]">{mainDisplayName}</span>
          </div>

          <span className="chat2-model-slash text-muted-foreground/40 text-[10px] select-none">/</span>

          <div className="chat2-model-content flex items-center gap-1 text-muted-foreground">
            {renderModelAvatar(contentModel, 13)}
            <span className="chat2-model-content-label truncate max-w-[85px]">{contentDisplayName}</span>
          </div>

          <ChevronDown className="h-3 w-3 opacity-60 shrink-0 ml-0.5" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-84 max-h-[420px] p-2 bg-popover/95 backdrop-blur-xl border border-border/60 shadow-2xl rounded-xl z-50 overflow-y-auto space-y-2"
      >
        {/* Header with Dual Tab Switcher & Refresh button */}
        <div className="flex items-center justify-between pb-1 border-b border-border/40">
          <div className="flex items-center gap-1 bg-muted/50 p-0.5 rounded-lg border border-border/40">
            <button
              type="button"
              onClick={() => setActiveTab("main")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                activeTab === "main"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bot className="h-3 w-3" />
              <span>Main Agent</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("content")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                activeTab === "content"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <PenTool className="h-3 w-3" />
              <span>Content Writer</span>
            </button>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fetchModels();
            }}
            className="flex items-center gap-1 hover:text-foreground transition-colors p-1 rounded cursor-pointer text-muted-foreground"
            title="Refresh models from Ollama API"
          >
            <RefreshCw className={`h-2.5 w-2.5 ${isLoading ? "animate-spin text-sky-400" : ""}`} />
            <span className="text-[9px]">Refresh</span>
          </button>
        </div>

        {/* Tab Role Description Banner */}
        <div className="px-1.5 py-1 rounded-md bg-muted/30 border border-border/30 text-[10px] text-muted-foreground leading-tight">
          {activeTab === "main" ? (
            <span>
              <strong className="text-foreground">Main Model:</strong> Orchestrates tools, commands, knowledge base search, and user chat.
            </span>
          ) : (
            <span>
              <strong className="text-foreground">Content Writer:</strong> Generates long-form markdown articles, tutorials, and creative prose via <code className="text-[9px] bg-muted/60 px-1 py-0.2 rounded font-mono">generate_content</code>.
            </span>
          )}
        </div>

        {/* Empty State when no models are installed */}
        {installedModels.length === 0 && !isLoading && (
          <div className="py-6 px-3 text-center space-y-1.5">
            <Layers className="h-6 w-6 text-muted-foreground/40 mx-auto" />
            <p className="text-[11px] font-medium text-foreground">No downloaded models found</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Make sure Ollama is running and pull a model using <code className="bg-muted px-1 py-0.5 rounded font-mono text-[9px]">ollama pull qwen2.5:7b</code>
            </p>
          </div>
        )}

        {/* Recommended Downloaded Models Section */}
        {installedFeatured.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-sky-400 px-1.5 py-0.5 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              <span>Recommended ({installedFeatured.length})</span>
            </div>

            <div className="space-y-1">
              {installedFeatured.map((fm) => {
                const isSelected = currentActiveModel.toLowerCase() === fm.id.toLowerCase();

                return (
                  <div
                    key={fm.id}
                    onClick={() => handleSelectModel(fm.id)}
                    className={`px-2.5 py-2 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? "bg-sky-500/10 border border-sky-500/40 text-foreground"
                        : "hover:bg-muted/70 border border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="flex flex-col gap-1 w-full text-left">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {renderModelAvatar(fm.id, 16)}
                          <span className="font-semibold text-foreground truncate font-mono text-[11px]">
                            {fm.displayName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded-full border font-medium ${fm.badgeColor}`}
                          >
                            {fm.badge}
                          </span>
                          {isSelected && <Check className="h-3 w-3 text-sky-400 ml-0.5 shrink-0" />}
                        </div>
                      </div>

                      <p className="text-[10px] text-muted-foreground leading-tight">
                        {fm.summary}
                      </p>

                      <div className="text-[9px] text-muted-foreground/70 font-mono flex items-center gap-2">
                        <span>{fm.details}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Other Downloaded Models Section */}
        {otherDownloadedModels.length > 0 && (
          <div className="pt-2 border-t border-border/40 space-y-1">
            <div className="text-[10px] font-semibold text-muted-foreground px-1.5 py-0.5 flex items-center gap-1">
              <Layers className="h-3 w-3" />
              <span>Downloaded Models ({otherDownloadedModels.length})</span>
            </div>

            <div className="space-y-0.5">
              {otherDownloadedModels.map((m) => {
                const isSelected = currentActiveModel.toLowerCase() === m.name.toLowerCase();

                return (
                  <div
                    key={m.name}
                    onClick={() => handleSelectModel(m.name)}
                    className={`px-2.5 py-1.5 rounded-lg cursor-pointer transition-all flex items-center justify-between font-mono text-[11px] ${
                      isSelected
                        ? "bg-sky-500/10 border border-sky-500/40 text-foreground"
                        : "hover:bg-muted/70 border border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {renderModelAvatar(m.name, 14)}
                      <span className="truncate">{m.name}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {m.parameter_size && (
                        <span className="text-[9px] text-muted-foreground bg-muted/60 px-1 py-0.5 rounded">
                          {m.parameter_size}
                        </span>
                      )}
                      {isSelected && <Check className="h-3 w-3 text-sky-400 ml-1" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
