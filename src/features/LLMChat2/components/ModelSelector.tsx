import { useEffect, useState, useCallback } from "react";
import { useAtom } from "jotai";
import { invoke } from "@tauri-apps/api/core";
import { Sparkles, Cpu, Bot, RefreshCw, Layers, ChevronDown, Check } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { chat2ModelAtom } from "../store/LLMChat2Store";

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
  icon: typeof Sparkles;
}

const FEATURED_MODELS: FeaturedModel[] = [
  {
    id: "qwen3.5:9b",
    displayName: "Qwen 3.5 9B",
    badge: "Best Quality",
    badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    summary: "Top reasoning (thinking mode), Vietnamese/Japanese, vision & 256K ctx",
    details: "~6.6GB RAM • High tool precision",
    icon: Sparkles,
  },
  {
    id: "qwen3.5:4b",
    displayName: "Qwen 3.5 4B",
    badge: "Fastest CPU",
    badgeColor: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    summary: "Ultra fast generation on CPU, lightweight, great tools & multilingual",
    details: "~3.4GB RAM • Outperforms 2.5:7B",
    icon: Cpu,
  },
  {
    id: "qwen2.5:7b",
    displayName: "Qwen 2.5 7B",
    badge: "Current Baseline",
    badgeColor: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    summary: "Standard text & tool model (shorter context, no thinking mode)",
    details: "~4.7GB RAM • Text only",
    icon: Bot,
  },
];

export function ModelSelector() {
  const [model, setModel] = useAtom(chat2ModelAtom);
  const [installedModels, setInstalledModels] = useState<OllamaModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await invoke<OllamaModelInfo[]>("llm2_list_models");
      setInstalledModels(list || []);
    } catch {
      // Ollama offline or error
      setInstalledModels([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const installedNames = new Set(installedModels.map((m) => m.name.toLowerCase()));
  const featuredIds = new Set(FEATURED_MODELS.map((m) => m.id.toLowerCase()));

  const otherModels = installedModels.filter(
    (m) => !featuredIds.has(m.name.toLowerCase())
  );

  const currentFeatured = FEATURED_MODELS.find(
    (m) => m.id.toLowerCase() === model.toLowerCase()
  );
  const CurrentIcon = currentFeatured?.icon || Bot;
  const currentDisplayName = currentFeatured?.displayName || model;

  const handleSelectModel = (selectedModelId: string) => {
    setModel(selectedModelId);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-6 w-auto flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/40 hover:bg-muted/70 border border-border/50 text-[11px] font-mono text-foreground transition-colors cursor-pointer select-none"
          title="Select active Ollama AI model"
        >
          <CurrentIcon className="h-3.5 w-3.5 text-sky-400 shrink-0" />
          <span className="font-medium truncate max-w-[130px]">{currentDisplayName}</span>
          <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-80 max-h-[380px] p-2 bg-popover/95 backdrop-blur-xl border border-border/60 shadow-2xl rounded-xl z-50 overflow-y-auto space-y-2"
      >
        {/* Header with refresh button */}
        <div className="flex items-center justify-between px-1.5 pb-1.5 border-b border-border/40 text-[10px] text-muted-foreground">
          <span className="font-semibold text-foreground/80 uppercase tracking-wider text-[9px]">
            Ollama Models
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fetchModels();
            }}
            className="flex items-center gap-1 hover:text-foreground transition-colors p-0.5 rounded cursor-pointer"
            title="Refresh models from Ollama API"
          >
            <RefreshCw className={`h-2.5 w-2.5 ${isLoading ? "animate-spin text-sky-400" : ""}`} />
            <span className="text-[9px]">Refresh</span>
          </button>
        </div>

        {/* Featured Models Section */}
        <div className="space-y-1">
          <div className="text-[10px] font-semibold text-sky-400 px-1.5 py-0.5 flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            <span>Recommended Models</span>
          </div>

          <div className="space-y-1">
            {FEATURED_MODELS.map((fm) => {
              const isSelected = model.toLowerCase() === fm.id.toLowerCase();
              const isInstalled =
                installedNames.has(fm.id.toLowerCase()) ||
                installedNames.has(`${fm.id}:latest`.toLowerCase()) ||
                installedNames.has(fm.id.split(":")[0]);
              const Icon = fm.icon;

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
                        <Icon className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-sky-400" : "text-muted-foreground"}`} />
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
                        {isInstalled && (
                          <span className="text-[9px] text-emerald-400 font-mono bg-emerald-500/10 px-1 py-0.2 rounded">
                            ready
                          </span>
                        )}
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

        {/* Other Local Models Section */}
        {otherModels.length > 0 && (
          <div className="pt-2 border-t border-border/40 space-y-1">
            <div className="text-[10px] font-semibold text-muted-foreground px-1.5 py-0.5 flex items-center gap-1">
              <Layers className="h-3 w-3" />
              <span>Other Installed Models ({otherModels.length})</span>
            </div>

            <div className="space-y-0.5">
              {otherModels.map((m) => {
                const isSelected = model.toLowerCase() === m.name.toLowerCase();

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
                      <Bot className="h-3 w-3 text-muted-foreground shrink-0" />
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
