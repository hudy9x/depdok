import { useCallback, useEffect, useState } from "react";
import { useSetAtom } from "jotai";
import {
  Check,
  Download,
  CheckCircle2,
  Trash2,
  ExternalLink,
  FolderOpen,
  LoaderCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { openUrl } from "@tauri-apps/plugin-opener";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  scanLocalLlmModels,
  downloadLlmModel,
  deleteLlmModel,
  revealLlmModelsDir,
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
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync form fields when config loads
  useEffect(() => {
    if (!config) return;
    setActiveTab((config.provider_type as ProviderTab) ?? "local");
    setSelectedLocalModel(config.local_model_path ?? "");
    setApiEndpoint(config.api_endpoint ?? "");
    setApiKey(config.api_key ?? "");
    setModelName(config.model_name ?? "");
  }, [config]);

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
      const newConfig: LlmConfig = {
        provider_type: activeTab as ProviderType,
        local_model_path: activeTab === "local" ? selectedLocalModel || null : null,
        api_endpoint: activeTab !== "local" ? apiEndpoint || null : null,
        api_key: ["open_a_i", "claude"].includes(activeTab) ? apiKey || null : null,
        model_name: modelName || null,
        gpu_layers: config?.gpu_layers ?? 0xFFFFFFFF,
        ctx_size: config?.ctx_size ?? 4096,
        max_tokens: config?.max_tokens ?? 1024,
        system_prompt: config?.system_prompt ?? null,
      };
      await saveAndLoad(newConfig);
    } catch {
      // Error handled in hook
    } finally {
      setIsSaving(false);
    }
  }, [activeTab, selectedLocalModel, apiEndpoint, apiKey, modelName, config, saveAndLoad]);

  const isDownloaded = (filename: string) =>
    downloadedFiles.some((f) => f.filename === filename);

  const getModelPath = (filename: string) =>
    downloadedFiles.find((f) => f.filename === filename)?.path ?? "";

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
            {activeTab === "local" && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Selected Model
                </Label>
                {selectedLocalModel ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/40 text-xs font-mono text-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <span className="truncate">{selectedLocalModel.split(/[/\\]/).pop()}</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No model selected. Download or pick a GGUF file below.
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={revealLlmModelsDir}
                >
                  <FolderOpen className="h-3 w-3" /> Open Models Folder
                </Button>
              </div>
            )}

            {activeTab === "ollama" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Ollama Endpoint</Label>
                  <Input
                    placeholder="http://localhost:11434"
                    value={apiEndpoint}
                    onChange={(e) => setApiEndpoint(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Model Name</Label>
                  <Input
                    placeholder="llama3, mistral, phi3..."
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
              </div>
            )}

            {activeTab === "lm_studio" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">LM Studio Endpoint</Label>
                  <Input
                    placeholder="http://localhost:1234"
                    value={apiEndpoint}
                    onChange={(e) => setApiEndpoint(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Model Name (optional)</Label>
                  <Input
                    placeholder="Leave blank to use the active model"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
              </div>
            )}

            {activeTab === "open_a_i" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">API Key</Label>
                  <div className="relative">
                    <Input
                      type={showKey ? "text" : "password"}
                      placeholder="sk-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="text-xs h-8 pr-9"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 cursor-pointer"
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Model</Label>
                  <Input
                    placeholder="gpt-4o"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Custom Endpoint (optional)</Label>
                  <Input
                    placeholder="https://api.openai.com"
                    value={apiEndpoint}
                    onChange={(e) => setApiEndpoint(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
              </div>
            )}

            {activeTab === "claude" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Anthropic API Key</Label>
                  <div className="relative">
                    <Input
                      type={showKey ? "text" : "password"}
                      placeholder="sk-ant-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="text-xs h-8 pr-9"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 cursor-pointer"
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Model</Label>
                  <Input
                    placeholder="claude-3-5-sonnet-20241022"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving || (activeTab === "local" && !selectedLocalModel)}
            className="h-8 text-xs cursor-pointer"
          >
            {isSaving ? (
              <><LoaderCircle className="h-3 w-3 animate-spin mr-1.5" /> Saving…</>
            ) : (
              activeTab === "local" ? "Save & Load Model" : "Save Configuration"
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
                  {CURATED_MODELS.map((model) => {
                    const downloaded = isDownloaded(model.filename);
                    const isSelected =
                      activeTab === "local" &&
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
                        <td className="py-2.5 px-3 text-center">
                          {isDownloading ? (
                            <LoaderCircle className="h-4 w-4 animate-spin text-primary mx-auto" />
                          ) : downloaded ? (
                            <div className="flex items-center justify-center gap-1">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(model.filename).catch(console.error);
                                }}
                                className="p-0.5 hover:text-red-500 text-muted-foreground/40 cursor-pointer transition-colors"
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
    </div>
  );
}
