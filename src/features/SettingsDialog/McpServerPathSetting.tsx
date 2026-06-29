import { useEffect, useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import hljs from "highlight.js";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import "highlight.js/styles/github-dark.css";

import { getMcpServerPaths } from "@/api-client/mcp";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function McpServerPathSetting(): JSX.Element {
  const [paths, setPaths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'claude' | 'claudecode' | 'copilot' | 'gemini' | 'codex' | 'opencode'>('claude');

  useEffect(() => {
    let cancelled = false;

    const detectPaths = async () => {
      try {
        const availablePaths = await getMcpServerPaths();

        if (!cancelled) {
          setPaths(availablePaths);
        }
      } catch (error) {
        console.error("[McpServerPathSetting] Failed to detect MCP path:", error);
        if (!cancelled) {
          setPaths([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    detectPaths();

    return () => {
      cancelled = true;
    };
  }, []);

  const isWindows = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("win");
  const serverPath = paths[0] || (isWindows ? "C:\\absolute\\path\\to\\depdok-mcp-server.exe" : "/absolute/path/to/depdok-mcp-server");

  const getAgentConfig = (
    tab: 'claude' | 'claudecode' | 'copilot' | 'gemini' | 'codex' | 'opencode',
    pathVal: string
  ) => {
    switch (tab) {
      case 'claude':
        return {
          path: isWindows
            ? "%APPDATA%\\Claude\\claude_desktop_config.json"
            : "~/Library/Application Support/Claude/claude_desktop_config.json",
          json: JSON.stringify(
            {
              mcpServers: {
                depdok: {
                  command: pathVal,
                  args: []
                }
              }
            },
            null,
            2
          )
        };
      case 'claudecode':
        return {
          path: ".mcp.json (Project root) or ~/.claude.json (User global)",
          json: JSON.stringify(
            {
              mcpServers: {
                depdok: {
                  type: "stdio",
                  command: pathVal,
                  args: []
                }
              }
            },
            null,
            2
          )
        };
      case 'copilot':
        return {
          path: ".vscode/mcp.json (VS Code) or ~/.copilot/mcp-config.json (CLI)",
          json: JSON.stringify(
            {
              servers: {
                depdok: {
                  command: pathVal,
                  args: []
                }
              }
            },
            null,
            2
          )
        };
      case 'gemini':
        return {
          path: "~/.gemini/settings.json (CLI) or .vscode/mcp.json (VS Code)",
          json: JSON.stringify(
            {
              mcpServers: {
                depdok: {
                  command: pathVal,
                  args: []
                }
              }
            },
            null,
            2
          )
        };
      case 'codex':
        return {
          path: ".vscode/mcp.json or codex-config.json",
          json: JSON.stringify(
            {
              name: "depdok",
              transport: "stdio",
              command: pathVal,
              args: [],
              env: {
                DEPDOK_MCP_MODE: "stdio"
              }
            },
            null,
            2
          )
        };
      case 'opencode':
        return {
          path: "opencode.jsonc (Project root)",
          json: JSON.stringify(
            {
              mcp: {
                depdok: {
                  type: "local",
                  command: [pathVal],
                  enabled: true
                }
              }
            },
            null,
            2
          )
        };
    }
  };

  const currentConfig = getAgentConfig(activeTab, serverPath);

  const copyToClipboard = async (value: string, message: string) => {
    try {
      await writeText(value);
      toast.success(message);
    } catch (error) {
      console.error("[McpServerPathSetting] Failed to copy:", error);
      toast.error("Failed to copy");
    }
  };

  const agents = [
    { id: "claude", name: "Claude Desktop", icon: "/ai-icons/claude-color.svg" },
    { id: "claudecode", name: "Claude Code", icon: "/ai-icons/claudecode-color.svg" },
    { id: "copilot", name: "Copilot", icon: "/ai-icons/copilot-color.svg" },
    { id: "gemini", name: "Gemini", icon: "/ai-icons/gemini-color.svg" },
    { id: "codex", name: "Codex", icon: "/ai-icons/openai.webp" },
    { id: "opencode", name: "OpenCode", icon: "/ai-icons/opencode.webp" },
  ] as const;

  return (
    <div className="space-y-4 w-full">
      <div className="space-y-0.5">
        <Label>MCP Server Configuration</Label>
        <p className="text-sm text-muted-foreground">
          Configure and connect your AI agents to the Depdok knowledge base.
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground animate-pulse">Checking installed MCP server path...</p>
      ) : (
        <div className="space-y-4 w-full">
          {/* Agent tabs selector (matching style of Theme selector) */}
          <div className="grid grid-cols-3 sm:grid-cols-6 bg-muted p-1 rounded-lg text-muted-foreground gap-1">
            {agents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${activeTab === agent.id
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/20"
                  }`}
                onClick={() => setActiveTab(agent.id)}
              >
                <img src={agent.icon} alt={agent.name} className="h-3.5 w-3.5 object-contain shrink-0" />
                {agent.name}
              </button>
            ))}
          </div>

          {/* Config file path and JSON code block */}
          <div className="space-y-3 w-full">
            <div className="flex flex-col gap-1 w-full">
              <Label className="text-xs font-medium text-muted-foreground">Config File Location</Label>
              <div className="relative">
                <Input readOnly value={currentConfig.path} className="text-xs pr-10" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 cursor-pointer hover:bg-muted shrink-0"
                  onClick={() => copyToClipboard(currentConfig.path.split(" (")[0], "Copied config file path")}
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span className="sr-only">Copy config file path</span>
                </Button>
              </div>
            </div>

            <div className="relative rounded-lg text-xs w-full bg-zinc-900 text-zinc-200">
              <div className="absolute top-2 right-2 flex gap-1 z-10">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-[10px] text-zinc-400 hover:text-white hover:bg-white/10 px-2 cursor-pointer"
                  onClick={() => copyToClipboard(currentConfig.json, "Copied JSON configuration")}
                >
                  <Copy className="h-3 w-3" />

                </Button>
              </div>
              <pre className="overflow-x-auto py-2 px-3 w-full whitespace-pre-wrap font-mono">
                <code
                  className="hljs language-json bg-transparent p-0 block"
                  dangerouslySetInnerHTML={{
                    __html: hljs.highlight(currentConfig.json, { language: "json" }).value,
                  }}
                />
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

