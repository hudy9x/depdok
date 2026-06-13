import { useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Cpu,
  Database,
  Eye,
  EyeOff,
  LoaderCircle,
  Sparkles,
} from "lucide-react";

import {
  getCurrentEmbeddingModel,
  updateEmbeddingModelAndReindex,
} from "@/api-client/knowledge-base";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { workspaceRootAtom } from "@/features/FileExplorer/store";

interface ModelInfo {
  id: string;
  name: string;
  type: "local" | "remote";
  dims: number;
  sizeMb?: number;
  languages: string;
  description: string;
}

const LOCAL_MODELS: ModelInfo[] = [
  {
    id: "all-MiniLM-L6-v2",
    name: "all-MiniLM-L6-v2",
    type: "local",
    dims: 384,
    sizeMb: 22,
    languages: "English",
    description: "Fast, lightweight model. Ideal for low-memory environments.",
  },
  {
    id: "all-MiniLM-L12-v2",
    name: "all-MiniLM-L12-v2",
    type: "local",
    dims: 384,
    sizeMb: 45,
    languages: "English",
    description: "Slightly more accurate MiniLM variant with similar latency.",
  },
  {
    id: "bge-small-en-v1.5",
    name: "bge-small-en-v1.5",
    type: "local",
    dims: 384,
    sizeMb: 45,
    languages: "English",
    description: "High performance small model by BAAI. English-focused.",
  },
  {
    id: "bge-base-en-v1.5",
    name: "bge-base-en-v1.5",
    type: "local",
    dims: 768,
    sizeMb: 110,
    languages: "English",
    description: "BAAI's base model. Superior search accuracy, moderate size.",
  },
  {
    id: "bge-large-en-v1.5",
    name: "bge-large-en-v1.5",
    type: "local",
    dims: 1024,
    sizeMb: 1340,
    languages: "English",
    description: "BAAI's large model. State-of-the-art accuracy, but high disk/RAM footprint.",
  },
  {
    id: "nomic-embed-text-v1.5",
    name: "nomic-embed-text-v1.5",
    type: "local",
    dims: 768,
    sizeMb: 280,
    languages: "English",
    description: "Local model with extended token context window (8k).",
  },
  {
    id: "multilingual-e5-small",
    name: "multilingual-e5-small",
    type: "local",
    dims: 384,
    sizeMb: 45,
    languages: "Multilingual (100+)",
    description: "Microsoft's E5 small multilingual model. Fast and low memory footprint.",
  },
  {
    id: "multilingual-e5-base",
    name: "multilingual-e5-base",
    type: "local",
    dims: 768,
    sizeMb: 110,
    languages: "Multilingual (100+)",
    description: "Microsoft's E5 base multilingual model. Good balance of speed and accuracy.",
  },
  {
    id: "multilingual-e5-large",
    name: "multilingual-e5-large",
    type: "local",
    dims: 1024,
    sizeMb: 560,
    languages: "Multilingual (100+)",
    description: "Microsoft's E5 large multilingual model. Outstanding accuracy.",
  },
  {
    id: "paraphrase-multilingual-MiniLM-L12-v2",
    name: "paraphrase-multilingual-MiniLM-L12-v2",
    type: "local",
    dims: 384,
    sizeMb: 220,
    languages: "Multilingual (50+)",
    description: "Lightweight and efficient multilingual sentence transformer.",
  },
  {
    id: "bge-small-zh-v1.5",
    name: "bge-small-zh-v1.5",
    type: "local",
    dims: 512,
    sizeMb: 90,
    languages: "Chinese, English",
    description: "BAAI's small Chinese-English bilingual model. Excellent for Chinese search.",
  },
  {
    id: "bge-large-zh-v1.5",
    name: "bge-large-zh-v1.5",
    type: "local",
    dims: 1024,
    sizeMb: 640,
    languages: "Chinese, English",
    description: "BAAI's large Chinese-English bilingual model. State-of-the-art accuracy for Chinese search.",
  },
];

const REMOTE_MODELS: ModelInfo[] = [
  {
    id: "text-embedding-3-small",
    name: "text-embedding-3-small",
    type: "remote",
    dims: 1536,
    languages: "Multilingual (100+)",
    description: "OpenAI's latest generation efficient remote embedder.",
  },
  {
    id: "text-embedding-3-large",
    name: "text-embedding-3-large",
    type: "remote",
    dims: 3072,
    languages: "Multilingual (100+)",
    description: "OpenAI's most capable remote embedding model.",
  },
  {
    id: "text-embedding-ada-002",
    name: "text-embedding-ada-002",
    type: "remote",
    dims: 1536,
    languages: "Multilingual",
    description: "OpenAI's legacy standard embedding model.",
  },
];

export function EmbeddingModelSetting(): JSX.Element {
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const [activeTab, setActiveTab] = useState<"local" | "remote">("local");
  const [currentModel, setCurrentModel] = useState<{
    type: string;
    name: string;
    key?: string;
    isDownloaded: boolean;
  } | null>(null);

  const [selectedModel, setSelectedModel] = useState<string>("all-MiniLM-L6-v2");
  const [openaiKey, setOpenaiKey] = useState<string>("");
  const [showKey, setShowKey] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isReindexing, setIsReindexing] = useState<boolean>(false);
  const [indexedCount, setIndexedCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const fetchCurrentModel = async () => {
      try {
        const res = await getCurrentEmbeddingModel();
        if (active) {
          setCurrentModel({
            type: res.modelType,
            name: res.modelName,
            key: res.openaiKey,
            isDownloaded: res.isDownloaded,
          });
          setSelectedModel(res.modelName);
          setActiveTab(res.modelType);
          if (res.openaiKey) {
            setOpenaiKey(res.openaiKey);
          }
        }
      } catch (err) {
        console.error("Failed to fetch current embedding model settings:", err);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void fetchCurrentModel();
    return () => {
      active = false;
    };
  }, []);

  const handleSelectModel = (model: ModelInfo) => {
    setSelectedModel(model.id);
  };

  const handleApplyModel = async () => {
    if (activeTab === "remote" && !openaiKey.trim()) {
      toast.error("Please enter a valid OpenAI API Key.");
      return;
    }

    if (!workspaceRoot) {
      toast.error("No active workspace. Please open a folder first.");
      return;
    }

    setIsReindexing(true);
    setIndexedCount(null);

    const promise = updateEmbeddingModelAndReindex(
      activeTab,
      selectedModel,
      activeTab === "remote" ? openaiKey : undefined,
      workspaceRoot
    );

    toast.promise(promise, {
      loading: `Re-indexing knowledge base with ${selectedModel}...`,
      success: (count) => {
        setIsReindexing(false);
        setIndexedCount(count);
        setCurrentModel({
          type: activeTab,
          name: selectedModel,
          key: activeTab === "remote" ? openaiKey : undefined,
          isDownloaded: true,
        });
        return `Successfully re-indexed ${count} sections!`;
      },
      error: (err: unknown) => {
        setIsReindexing(false);
        console.error("Reindexing failed:", err);
        return `Failed to update model and re-index: ${String(err)}`;
      },
    });
  };

  const hasChanged =
    currentModel?.type !== activeTab ||
    currentModel?.name !== selectedModel ||
    (activeTab === "remote" && currentModel?.key !== openaiKey) ||
    currentModel?.isDownloaded === false;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeModels = activeTab === "local" ? LOCAL_MODELS : REMOTE_MODELS;
  const currentActiveModelInfo = [...LOCAL_MODELS, ...REMOTE_MODELS].find(
    (m) => m.id === currentModel?.name
  );

  return (
    <div className="space-y-6 w-full">
      {/* Active Model Indicator */}
      <div className="flex flex-col gap-1.5 p-4 rounded-xl border border-border/60 bg-muted/20">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Active Embedding Model
        </Label>
        {currentActiveModelInfo ? (
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground text-sm">
                  {currentActiveModelInfo.name}
                </span>
                {currentActiveModelInfo.type === "local" ? (
                  currentModel?.isDownloaded ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary font-medium text-secondary-foreground flex items-center gap-1">
                      <Cpu className="w-3 h-3" /> Offline (Local)
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-800 dark:text-yellow-800 border border-yellow-500/30 font-medium flex items-center gap-1 animate-pulse">
                      <AlertTriangle className="w-3 h-3 text-yellow-500" /> Offline (Not Downloaded)
                    </span>
                  )
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary font-medium text-secondary-foreground flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Online (Remote)
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground max-w-xl">
                {currentActiveModelInfo.description}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-muted-foreground font-medium">
                Dimensions: {currentActiveModelInfo.dims}
              </div>
              {currentActiveModelInfo.sizeMb && (
                <div className="text-xs text-muted-foreground">
                  Model Size: {currentActiveModelInfo.sizeMb} MB
                </div>
              )}
              <div className="text-xs text-muted-foreground font-medium">
                Languages: {currentActiveModelInfo.languages}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No model active or configured.</p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Select Embedding Model</Label>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Choose a model for text vectorization. Offline models run fully on your device,
          while remote models require internet access and API keys.
        </p>
      </div>

      {/* Model Type Selector */}
      <div className="grid grid-cols-2 bg-muted p-1 rounded-lg text-muted-foreground gap-1 max-w-sm">
        <button
          type="button"
          disabled={isReindexing}
          className={`flex items-center justify-center gap-2 rounded-md py-1.5 text-xs font-medium transition-all cursor-pointer ${activeTab === "local"
            ? "bg-background text-foreground shadow-sm font-semibold"
            : "text-muted-foreground hover:text-foreground hover:bg-background/20"
            }`}
          onClick={() => {
            setActiveTab("local");
            setSelectedModel(LOCAL_MODELS[0].id);
          }}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Local Models (Offline)</span>
        </button>
        <button
          type="button"
          disabled={isReindexing}
          className={`flex items-center justify-center gap-2 rounded-md py-1.5 text-xs font-medium transition-all cursor-pointer ${activeTab === "remote"
            ? "bg-background text-foreground shadow-sm font-semibold"
            : "text-muted-foreground hover:text-foreground hover:bg-background/20"
            }`}
          onClick={() => {
            setActiveTab("remote");
            setSelectedModel(REMOTE_MODELS[0].id);
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Remote Models (Online)</span>
        </button>
      </div>

      {/* Models List Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
                <th className="py-3 px-4 w-10"></th>
                <th className="py-3 px-4">Model Name</th>
                <th className="py-3 px-4 text-center">Dims</th>
                <th className="py-3 px-4 text-center">Languages</th>
                <th className="py-3 px-4 text-center">Disk Size</th>
                <th className="py-3 px-4">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {activeModels.map((model) => {
                const isSelected = selectedModel === model.id;
                const isActive = currentModel?.name === model.id && currentModel?.type === activeTab;
                return (
                  <tr
                    key={model.id}
                    className={`hover:bg-muted/30 transition-colors cursor-pointer ${isSelected ? "bg-primary/5 dark:bg-primary/10" : ""
                      }`}
                    onClick={() => !isReindexing && handleSelectModel(model)}
                  >
                    <td className="py-3 px-4 text-center">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30 bg-transparent"
                          }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <span>{model.name}</span>
                        {isActive && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${currentModel?.isDownloaded
                            ? "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30"
                            : "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30"
                            }`}>
                            {currentModel?.isDownloaded ? "Active" : "Active (Missing weights)"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-medium text-muted-foreground">
                      {model.dims}
                    </td>
                    <td className="py-3 px-4 text-center font-medium text-muted-foreground">
                      {model.languages}
                    </td>
                    <td className="py-3 px-4 text-center text-muted-foreground">
                      {model.sizeMb ? `${model.sizeMb} MB` : "N/A"}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground max-w-xs truncate" title={model.description}>
                      {model.description}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Remote Model API Key Input */}
      {activeTab === "remote" && (
        <div className="space-y-2 max-w-md">
          <Label htmlFor="openai-key" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            OpenAI API Key
          </Label>
          <div className="relative">
            <Input
              id="openai-key"
              type={showKey ? "text" : "password"}
              placeholder="sk-..."
              value={openaiKey}
              disabled={isReindexing}
              onChange={(e) => setOpenaiKey(e.target.value)}
              className="text-xs pr-10 border-border/80"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={isReindexing}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 cursor-pointer hover:bg-muted"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              <span className="sr-only">Toggle key visibility</span>
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Required to send queries and document chunks to OpenAI embedding endpoints.
          </p>
        </div>
      )}

      {/* Warnings & Action Section */}
      {hasChanged && (
        <div className="space-y-4">
          <div className="flex gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-400">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-semibold">Database Updates Required</h4>
              <p className="text-[11px] leading-normal opacity-90">
                Selecting a new embedding model requires dropping the current vector tables and
                re-scanning your active workspace. Your notes will remain untouched on disk, but the
                vector databases will be wiped and re-indexed.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="default"
              disabled={isReindexing || !workspaceRoot}
              onClick={handleApplyModel}
              className="font-semibold text-xs py-2 px-4 flex items-center gap-2 cursor-pointer shadow-sm"
            >
              {isReindexing ? (
                <>
                  <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                  <span>Re-indexing...</span>
                </>
              ) : (
                <>
                  <Database className="w-3.5 h-3.5" />
                  <span>Apply & Re-index Database</span>
                </>
              )}
            </Button>
            {!workspaceRoot && (
              <span className="text-xs text-destructive font-medium">
                Please open a workspace folder to enable re-indexing.
              </span>
            )}
          </div>
        </div>
      )}

      {isReindexing && (
        <div className="flex items-center gap-2 p-3 bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/20 max-w-md">
          <LoaderCircle className="w-4 h-4 animate-spin text-primary" />
          <span className="text-[11px] text-primary font-medium">
            Re-indexing files in workspace directory. Please do not close settings or exit the app.
          </span>
        </div>
      )}

      {indexedCount !== null && (
        <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20 max-w-md text-green-600 dark:text-green-400">
          <Check className="w-4 h-4 stroke-[3]" />
          <span className="text-[11px] font-medium">
            Successfully completed! Re-indexed {indexedCount} markdown sections.
          </span>
        </div>
      )}
    </div>
  );
}
