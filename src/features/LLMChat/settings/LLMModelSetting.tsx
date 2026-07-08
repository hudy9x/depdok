import { useCallback, useEffect, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { appDataDir, join } from "@tauri-apps/api/path";
import { platform } from "@tauri-apps/plugin-os";
import {
  Check,
  Download,
  CheckCircle2,
  Trash2,
  ExternalLink,
  LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";
import { openUrl } from "@tauri-apps/plugin-opener";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { openFolderDialog } from "@/features/FileExplorer/api";
import { ClaudeProviderSettings } from "./ClaudeProviderSettings";
import { LmStudioProviderSettings } from "./LmStudioProviderSettings";
import { LocalProviderSettings } from "./LocalProviderSettings";
import { OllamaProviderSettings } from "./OllamaProviderSettings";
import { OpenAiProviderSettings } from "./OpenAiProviderSettings";

import {
  scanLocalLlmModels,
  downloadLlmModel,
  deleteLlmModel,
  revealLlmModelsDir,
  getLlmModelsDir,
  onLlmModelDownloadProgress,
} from "../api/llm";
import type { GgufModelInfo, LlmConfig, ProviderType } from "../api/llm";
import { useLlmConfig } from "../hooks/useLlmConfig";
import { localGgufModelsAtom, modelDownloadProgressAtom } from "../store/LLMChatStore";

// ─── Pre-curated GGUF model list ──────────────────────────────────────────────

interface CuratedModel {
  name: string;
  filename: string;
  quant: string;
  sizGb: number;
  description: string;
  hfRepo: string;
  downloadUrl: string;
}

const CURATED_MODELS: CuratedModel[] = [
  {
    name: "Qwen2.5-7B-Instruct",
    filename: "qwen2.5-7b-instruct-q4_k_m.gguf",
    quant: "Q4_K_M",
    sizGb: 4.7,
    description: "Multilingual, strong tool calling & coding",
    hfRepo: "Qwen/Qwen2.5-7B-Instruct-GGUF",
    downloadUrl:
      "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf",
  },
  {
    name: "Qwen2.5-3B-Instruct",
    filename: "qwen2.5-3b-instruct-q4_k_m.gguf",
    quant: "Q4_K_M",
    sizGb: 2.0,
    description: "Lightweight multilingual, fast inference",
    hfRepo: "Qwen/Qwen2.5-3B-Instruct-GGUF",
    downloadUrl:
      "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf",
  },
  {
    name: "Llama-3.2-3B-Instruct",
    filename: "Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    quant: "Q4_K_M",
    sizGb: 2.0,
    description: "Fast, strong reasoning",
    hfRepo: "bartowski/Llama-3.2-3B-Instruct-GGUF",
    downloadUrl:
      "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
  },
  {
    name: "Llama-3.1-8B-Instruct",
    filename: "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
    quant: "Q4_K_M",
    sizGb: 4.9,
    description: "Best open-weights balance of quality & speed",
    hfRepo: "bartowski/Meta-Llama-3.1-8B-Instruct-GGUF",
    downloadUrl:
      "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
  },
  {
    name: "Phi-3.5-mini-instruct",
    filename: "Phi-3.5-mini-instruct-Q4_K_M.gguf",
    quant: "Q4_K_M",
    sizGb: 2.2,
    description: "Ultra-fast on CPU, tiny RAM footprint",
    hfRepo: "bartowski/Phi-3.5-mini-instruct-GGUF",
    downloadUrl:
      "https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf",
  },
  {
    name: "gemma-2-2b-it",
    filename: "gemma-2-2b-it-Q4_K_M.gguf",
    quant: "Q4_K_M",
    sizGb: 1.6,
    description: "Minimal footprint, Google's efficient model",
    hfRepo: "bartowski/gemma-2-2b-it-GGUF",
    downloadUrl:
      "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf",
  },
  {
    name: "DeepSeek-Coder-V2-Lite",
    filename: "DeepSeek-Coder-V2-Lite-Instruct-Q4_K_M.gguf",
    quant: "Q4_K_M",
    sizGb: 8.9,
    description: "Best code generation, optimized for developers",
    hfRepo: "bartowski/DeepSeek-Coder-V2-Lite-Instruct-GGUF",
    downloadUrl:
      "https://huggingface.co/bartowski/DeepSeek-Coder-V2-Lite-Instruct-GGUF/resolve/main/DeepSeek-Coder-V2-Lite-Instruct-Q4_K_M.gguf",
  },
];

// ─── Provider tab definitions ─────────────────────────────────────────────────

type ProviderTab = "local" | "ollama" | "lm_studio" | "open_a_i" | "claude";

const PROVIDER_TABS: Array<{ id: ProviderTab; label: string }> = [
  { id: "local", label: "Local (GGUF)" },
  { id: "ollama", label: "Ollama" },
  { id: "lm_studio", label: "LM Studio" },
  { id: "open_a_i", label: "OpenAI" },
  { id: "claude", label: "Claude" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export function LLMModelSetting() {
  const { config, saveAndLoad } = useLlmConfig();
  const setLocalModels = useSetAtom(localGgufModelsAtom);
  const setDownloadProgress = useSetAtom(modelDownloadProgressAtom);
  const downloadProgress = useAtomValue(modelDownloadProgressAtom);
  const isWindows = platform() === "windows";

  const [activeTab, setActiveTab] = useState<ProviderTab>(
    (config?.provider_type as ProviderTab) ?? "local",
  );
  const [downloadedFiles, setDownloadedFiles] = useState<GgufModelInfo[]>([]);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [selectedLocalModel, setSelectedLocalModel] = useState<string>(
    config?.local_model_path ?? "",
  );

  // Remote provider fields
  const [apiEndpoint, setApiEndpoint] = useState(config?.api_endpoint ?? "");
  const [apiKey, setApiKey] = useState(config?.api_key ?? "");
  const [modelName, setModelName] = useState(config?.model_name ?? "");
  const [customModelsDir, setCustomModelsDir] = useState(config?.custom_models_dir ?? "");
  const [defaultModelsDir, setDefaultModelsDir] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Sync form fields when config loads
  useEffect(() => {
    if (!config) return;
    setActiveTab((config.provider_type as ProviderTab) ?? "local");
    setSelectedLocalModel(config.local_model_path ?? "");
    setApiEndpoint(config.api_endpoint ?? "");
    setApiKey(config.api_key ?? "");
    setModelName(config.model_name ?? "");
    setCustomModelsDir(config.custom_models_dir ?? "");
  }, [config]);

  useEffect(() => {
    if (!isWindows) {
      return;
    }

    let active = true;
    const loadDefaultModelsDir = async () => {
      try {
        const baseDir = await appDataDir();
        const modelsDir = await join(baseDir, "llm-models");
        if (active) {
          setDefaultModelsDir(modelsDir);
        }
      } catch (error) {
        console.error("Failed to resolve default models directory:", error);
      }
    };

    loadDefaultModelsDir().catch(console.error);
    return () => {
      active = false;
    };
  }, [isWindows]);

  // Scan local models on mount
  useEffect(() => {
    let active = true;
    scanLocalLlmModels()
      .then((models) => {
        if (active) {
          setDownloadedFiles(models);
          setLocalModels(models);
        }
      })
      .catch(console.error);
    return () => { active = false; };
  }, [setLocalModels]);

  const refreshModels = useCallback(async () => {
    const models = await scanLocalLlmModels();
    setDownloadedFiles(models);
    setLocalModels(models);
  }, [setLocalModels]);

  const handleDownload = useCallback(
    async (model: CuratedModel) => {
      setDownloadingFile(model.filename);
      setDownloadProgress(0);

      let unlisten: (() => void) | null = null;
      try {
        unlisten = await onLlmModelDownloadProgress((pct) => {
          setDownloadProgress(Math.min(pct, 99));
        });

        await downloadLlmModel(model.downloadUrl, model.filename);
        await refreshModels();
        setDownloadProgress(null);
        toast.success(`Downloaded ${model.name}`);
      } catch (err) {
        setDownloadProgress(null);
        toast.error(`Download failed: ${String(err)}`);
      } finally {
        unlisten?.();
        setDownloadingFile(null);
      }
    },
    [refreshModels, setDownloadProgress],
  );

  const handleDelete = useCallback(
    async (filename: string) => {
      try {
        await deleteLlmModel(filename);
        await refreshModels();
        if (selectedLocalModel.endsWith(filename)) {
          setSelectedLocalModel("");
        }
        toast.success(`Deleted ${filename}`);
      } catch (err) {
        toast.error(`Delete failed: ${String(err)}`);
      }
    },
    [refreshModels, selectedLocalModel],
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const trimmedCustomModelsDir = customModelsDir.trim();
      const nextCustomModelsDir = activeTab === "local" && isWindows && trimmedCustomModelsDir
        ? trimmedCustomModelsDir
        : null;
      const currentCustomModelsDir = config?.custom_models_dir ?? null;
      const customDirChanged = nextCustomModelsDir !== currentCustomModelsDir;
      const newConfig: LlmConfig = {
        provider_type: activeTab as ProviderType,
        local_model_path: activeTab === "local"
          ? (customDirChanged ? null : selectedLocalModel || null)
          : null,
        custom_models_dir: nextCustomModelsDir,
        api_endpoint: activeTab !== "local" ? apiEndpoint || null : null,
        api_key: ["open_a_i", "claude"].includes(activeTab) ? apiKey || null : null,
        model_name: modelName || null,
        gpu_layers: config?.gpu_layers ?? 0xFFFFFFFF,
        ctx_size: config?.ctx_size ?? 4096,
        max_tokens: config?.max_tokens ?? 1024,
        system_prompt: config?.system_prompt ?? null,
      };
      await saveAndLoad(newConfig);
      if (customDirChanged) {
        setSelectedLocalModel("");
      }
      await refreshModels();
    } catch {
      // Error handled in hook
    } finally {
      setIsSaving(false);
    }
  }, [
    activeTab,
    apiEndpoint,
    apiKey,
    config,
    customModelsDir,
    isWindows,
    modelName,
    refreshModels,
    saveAndLoad,
    selectedLocalModel,
  ]);

  const handleChooseModelsDir = useCallback(async () => {
    const folderPath = await openFolderDialog();
    if (!folderPath) {
      return;
    }

    setCustomModelsDir(folderPath);
    setSelectedLocalModel("");
  }, []);

  const handleResetModelsDir = useCallback(() => {
    setCustomModelsDir("");
    setSelectedLocalModel("");
  }, []);

  const handleOpenModelsFolder = useCallback(async () => {
    try {
      const modelsDir = await getLlmModelsDir();
      await revealLlmModelsDir();
      toast.success(`Opened models folder: ${modelsDir}`);
    } catch (err) {
      toast.error(`Failed to open models folder: ${String(err)}`);
    }
  }, []);

  const isDownloaded = (filename: string) =>
    downloadedFiles.some((f) => f.filename === filename);

  const customDirChanged = (config?.custom_models_dir ?? "") !== customModelsDir;
  const localSaveLabel = activeTab === "local"
    ? (selectedLocalModel && !customDirChanged ? "Save & Load Model" : "Save Configuration")
    : "Save Configuration";

  const getModelPath = (filename: string) =>
    downloadedFiles.find((f) => f.filename === filename)?.path ?? "";

  const renderProviderSettings = () => {
    switch (activeTab) {
      case "local":
        return (
          <LocalProviderSettings
            selectedLocalModel={selectedLocalModel}
            isWindows={isWindows}
            customModelsDir={customModelsDir}
            defaultModelsDir={defaultModelsDir}
            onOpenModelsFolder={() => {
              handleOpenModelsFolder().catch(console.error);
            }}
            onChooseModelsDir={() => {
              handleChooseModelsDir().catch(console.error);
            }}
            onResetModelsDir={handleResetModelsDir}
          />
        );
      case "ollama":
        return (
          <OllamaProviderSettings
            apiEndpoint={apiEndpoint}
            modelName={modelName}
            onApiEndpointChange={setApiEndpoint}
            onModelNameChange={setModelName}
          />
        );
      case "lm_studio":
        return (
          <LmStudioProviderSettings
            apiEndpoint={apiEndpoint}
            modelName={modelName}
            onApiEndpointChange={setApiEndpoint}
            onModelNameChange={setModelName}
          />
        );
      case "open_a_i":
        return (
          <OpenAiProviderSettings
            apiKey={apiKey}
            modelName={modelName}
            apiEndpoint={apiEndpoint}
            onApiKeyChange={setApiKey}
            onModelNameChange={setModelName}
            onApiEndpointChange={setApiEndpoint}
          />
        );
      case "claude":
        return (
          <ClaudeProviderSettings
            apiKey={apiKey}
            modelName={modelName}
            onApiKeyChange={setApiKey}
            onModelNameChange={setModelName}
          />
        );
      default:
        return null;
    }
  };

  const allModels = [...CURATED_MODELS];
  for (const file of downloadedFiles) {
    if (!CURATED_MODELS.some((m) => m.filename === file.filename)) {
      allModels.push({
        name: file.filename.replace(/\.gguf$/i, ""),
        filename: file.filename,
        quant: "Custom",
        sizGb: Math.round((file.size_bytes / (1024 * 1024 * 1024)) * 10) / 10,
        description: "Custom GGUF model found in models directory",
        hfRepo: "",
        downloadUrl: "",
      });
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-0">
      <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0 space-y-6 p-8">

        {/* Section 1: Provider Configuration */}
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold">LLM Provider</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose your inference backend. Local models run on-device; remote providers require API access.
            </p>
          </div>

          {/* Provider tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {PROVIDER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 text-xs font-medium rounded-md py-1.5 transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Provider-specific fields */}
          <div className="space-y-3 rounded-xl border border-border/60 p-4 bg-muted/10">
            {renderProviderSettings()}
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="h-8 text-xs cursor-pointer"
          >
            {isSaving ? (
              <><LoaderCircle className="h-3 w-3 animate-spin mr-1.5" /> Saving…</>
            ) : (
              localSaveLabel
            )}
          </Button>
        </div>

        {/* Divider */}
        <div className="border-t border-border/40" />

        {/* Section 2: GGUF Model Manager */}
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold">Local GGUF Models</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Download models from Hugging Face. They are stored in the app's models directory.
            </p>
          </div>

          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                    <th className="py-2.5 px-3 w-8" />
                    <th className="py-2.5 px-3">Model</th>
                    <th className="py-2.5 px-3 text-center w-20">Quant</th>
                    <th className="py-2.5 px-3 text-center w-16">Size</th>
                    <th className="py-2.5 px-3 text-center w-24">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allModels.map((model) => {
                    const downloaded = isDownloaded(model.filename);
                    const isSelected =
                      activeTab === "local" &&
                      downloaded &&
                      selectedLocalModel === getModelPath(model.filename);
                    const isDownloading = downloadingFile === model.filename;

                    return (
                      <tr
                        key={model.filename}
                        className={`hover:bg-muted/20 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                        onClick={() => {
                          if (downloaded && activeTab === "local") {
                            setSelectedLocalModel(getModelPath(model.filename));
                          }
                        }}
                      >
                        <td className="py-2.5 px-3 text-center">
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground/30"
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground">{model.name}</span>
                            {model.hfRepo && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openUrl(
                                    `https://huggingface.co/${model.hfRepo}`,
                                  ).catch(console.error);
                                }}
                                className="text-muted-foreground/50 hover:text-primary cursor-pointer"
                                title="View on HuggingFace"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {model.description}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 text-center text-muted-foreground font-mono">
                          {model.quant}
                        </td>
                        <td className="py-2.5 px-3 text-center text-muted-foreground">
                          {model.sizGb} GB
                        </td>
                        <td className="py-2.5 px-3 text-center group/status relative">
                          {isDownloading ? (
                            <LoaderCircle className="h-4 w-4 animate-spin text-primary mx-auto" />
                          ) : downloaded ? (
                            <div className="flex items-center justify-center min-h-[28px]">
                              <div className="group-hover/status:hidden text-green-500" title="Downloaded">
                                <CheckCircle2 className="h-4 w-4" />
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(model.filename).catch(console.error);
                                }}
                                className="hidden group-hover/status:inline-flex p-1 rounded hover:bg-red-500/10 text-red-500 transition-colors cursor-pointer items-center justify-center"
                                title="Delete model"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(model).catch(console.error);
                              }}
                              className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground cursor-pointer transition-colors inline-flex items-center justify-center mx-auto"
                              title="Download model"
                              disabled={!!downloadingFile}
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {downloadProgress !== null && (
        <div className="shrink-0 border-t border-border px-8 py-4 bg-background/95 backdrop-blur-sm">
          <div className="flex items-center justify-between text-[11px] font-medium">
            <span className="text-foreground flex items-center gap-1.5">
              <LoaderCircle className="w-3.5 h-3.5 animate-spin text-primary" />
              {downloadingFile
                ? `Downloading ${downloadingFile}...`
                : "Downloading model weights..."}
            </span>
            <span className="text-muted-foreground font-semibold">
              {`${Math.floor(downloadProgress)}%`}
            </span>
          </div>
          <div className="w-full bg-secondary h-2 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${Math.min(Math.max(downloadProgress, 0), 100)}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
