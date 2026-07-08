import { useAtom } from "jotai";
import { Bot, Database, Puzzle, Settings, Terminal, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { autoSaveEnabledAtom, themeAtom } from "@/stores/SettingsStore";

import { AssetsFolderSetting } from "./AssetsFolderSetting";
import { EmbeddingModelSetting } from "./EmbeddingModelSetting";
import { McpServerPathSetting } from "./McpServerPathSetting";
import { MonacoThemeSetting } from "./MonacoThemeSetting";
import { PlantUmlServerSetting } from "./PlantUmlServerSetting";
import { CliCommandSetting } from "./CliCommandSetting";
import { ContextMenuSetting } from "./ContextMenuSetting";
import { ThemeSetting } from "./ThemeSetting";
import { LLMModelSetting } from "@/features/LLMChat";
import { VscMcp } from "react-icons/vsc";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: SettingsTab;
}

type SettingsTab = "general" | "integrations" | "system" | "mcp" | "embeddings" | "ai-models";

export function SettingsDialog({ open, onOpenChange, defaultTab }: SettingsDialogProps) {
  const [autoSaveEnabled, setAutoSaveEnabled] = useAtom(autoSaveEnabledAtom);
  const [selectedTheme] = useAtom(themeAtom);
  const { setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  // Sync activeTab with defaultTab when the dialog opens
  useEffect(() => {
    if (open && defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [open, defaultTab]);

  // Sync theme changes with next-themes
  useEffect(() => {
    setTheme(selectedTheme);
  }, [selectedTheme, setTheme]);

  const tabs = [
    {
      id: "general",
      name: "General",
      icon: Settings,
      desc: "Editor appearance, theme, and behavior",
    },
    {
      id: "integrations",
      name: "Integrations",
      icon: Puzzle,
      desc: "Third-party tools and plugins",
    },
    {
      id: "system",
      name: "OS Integration",
      icon: Terminal,
      desc: "Command line and file explorer integration options",
    },
    {
      id: "embeddings",
      name: "Embedding Models",
      icon: Database,
      desc: "Configure local or remote AI embedding models",
    },
    {
      id: "mcp",
      name: "MCP Server",
      icon: VscMcp,
      desc: "Model Context Protocol connections",
    },
    {
      id: "ai-models",
      name: "AI Models",
      icon: Bot,
      desc: "Configure LLM providers and manage local GGUF models",
    },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="fixed !top-16 !left-16 !right-16 !bottom-16 !translate-x-0 !translate-y-0 !w-auto !h-auto !max-w-none sm:!max-w-none !p-0 !gap-0 border border-border rounded-2xl overflow-hidden shadow-2xl grid grid-cols-[260px_1fr] bg-card"
      >
        {/* Left Column: Sidebar */}
        <div className="border-r border-border bg-muted/20 p-6 flex flex-col gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-lg text-foreground">
              <Settings className="w-5 h-5 text-primary" />
              <span>Settings</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Configure and customize your workspace and editor preferences.
            </p>
          </div>

          <nav className="flex flex-col gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer text-left w-full",
                    activeTab === tab.id
                      ? "bg-secondary text-secondary-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  )}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Column: Main Content */}
        <div className="flex flex-col h-full overflow-hidden bg-background">
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-border shrink-0">
            <div className="space-y-0.5">
              <h2 className="text-lg font-semibold tracking-tight">
                {tabs.find((t) => t.id === activeTab)?.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                {tabs.find((t) => t.id === activeTab)?.desc}
              </p>
            </div>
            <DialogClose className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none p-1.5 hover:bg-secondary cursor-pointer">
              <X className="h-4 w-4 text-muted-foreground" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>

          {/* Settings Scrollable View */}
          <div
            className={cn(
              "flex-1",
              activeTab === "embeddings" || activeTab === "ai-models"
                ? "overflow-hidden flex flex-col"
                : "overflow-y-auto space-y-6"
            )}
          >
            {activeTab === "general" && (
              <div className="space-y-6  p-8">
                {/* Theme Switcher */}
                <div className="border-b pb-6 border-border/40">
                  <ThemeSetting />
                </div>

                <div className="border-b pb-6 border-border/40">
                  <MonacoThemeSetting />
                </div>

                {/* Auto-save toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-save" className="text-sm font-medium">Auto-save</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically save changes to file
                    </p>
                  </div>
                  <Switch
                    id="auto-save"
                    checked={autoSaveEnabled}
                    onCheckedChange={setAutoSaveEnabled}
                  />
                </div>
              </div>
            )}

            {activeTab === "integrations" && (
              <div className="space-y-6  p-8">
                <div className="border-b pb-6 border-border/40">
                  <PlantUmlServerSetting />
                </div>
                <div>
                  <AssetsFolderSetting />
                </div>
              </div>
            )}

            {activeTab === "system" && (
              <div className="space-y-6  p-8">
                <div className="border-b pb-6 border-border/40">
                  <CliCommandSetting />
                </div>
                <div>
                  <ContextMenuSetting />
                </div>
              </div>
            )}

            {activeTab === "embeddings" && (
              <EmbeddingModelSetting />
            )}

            {activeTab === "mcp" && (
              <div className="space-y-6 p-8">
                <McpServerPathSetting />
              </div>
            )}

            {activeTab === "ai-models" && (
              <LLMModelSetting />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
