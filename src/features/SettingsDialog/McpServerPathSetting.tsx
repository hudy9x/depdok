import { useEffect, useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { getMcpServerPaths } from "@/api-client/mcp";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function McpServerPathSetting(): JSX.Element {
  const [paths, setPaths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'claude' | 'copilot' | 'gemini' | 'codex'>('claude');
  const writeAccess = true;

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

  const serverPath = paths[0] || "/absolute/path/to/depdok-mcp-server";

  const getAgentConfig = (
    tab: 'claude' | 'copilot' | 'gemini' | 'codex',
    pathVal: string,
    isWrite: boolean
  ) => {
    const args = isWrite ? ["--write-enabled"] : ["--read-only"];
    switch (tab) {
      case 'claude':
        return {
          path: "~/Library/Application Support/Claude/claude_desktop_config.json",
          json: JSON.stringify(
            {
              mcpServers: {
                depdok: {
                  command: pathVal,
                  args: args
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
                  args: args
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
                  args: args
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
              args: args,
              env: {
                DEPDOK_MCP_MODE: "stdio"
              }
            },
            null,
            2
          )
        };
    }
  };

  const currentConfig = getAgentConfig(activeTab, serverPath, writeAccess);

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
    { id: "claude", name: "Claude" },
    { id: "copilot", name: "Copilot" },
    { id: "gemini", name: "Gemini" },
    { id: "codex", name: "Codex" },
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
          <div className="flex bg-muted p-1 rounded-lg text-muted-foreground gap-1">
            {agents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all cursor-pointer ${activeTab === agent.id
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/20"
                  }`}
                onClick={() => setActiveTab(agent.id)}
              >
                {agent.name}
              </button>
            ))}
          </div>

          {/* Write Access Toggle */}
          {/* <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/20">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Enable Write Access</Label>
              <p className="text-xs text-muted-foreground">
                Allows the agent to modify or create files in the knowledge base
              </p>
            </div>
            <Switch
              checked={writeAccess}
              onCheckedChange={setWriteAccess}
              aria-label="Toggle Write Access"
            />
          </div> */}

          {/* Binary Path Info */}
          {paths.length > 0 ? (
            <div className="space-y-1 w-full min-w-0">
              <Label className="text-xs truncate font-medium text-muted-foreground">Detected Binary Path</Label>
              <div className="relative ">
                {/* <code className="flex-1 text-xs truncate min-w-0">{serverPath}</code> */}
                <Input readOnly value={serverPath} className="text-xs" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 cursor-pointer hover:bg-muted shrink-0"
                  onClick={() => copyToClipboard(serverPath, "Copied binary path")}
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span className="sr-only">Copy binary path</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-amber-500 bg-amber-500/10 rounded-md border border-amber-500/20 p-2 w-full">
              MCP server binary was not found in /Applications or ~/Applications. If you installed Depdok in a custom location, run: <code className="block mt-1 p-1 bg-amber-500/20 rounded break-all">find /Applications ~/Applications -name depdok-mcp-server 2&gt;/dev/null</code>
            </div>
          )}

          {/* Config file path and JSON code block */}
          <div className="space-y-2 w-full">
            {/* <div className="flex flex-col gap-1 w-full">
              <Label className="text-xs font-medium text-muted-foreground">Config File Location</Label>
              <div className="relative">
                <Input readOnly value={currentConfig.path} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 cursor-pointer hover:bg-muted shrink-0"
                  onClick={() => copyToClipboard(currentConfig.path.split(" (")[0], "Copied config file path")}
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span className="sr-only">Copy config file path</span>
                </Button>
              </div>
            </div> */}

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
              <div className="overflow-x-auto py-2 px-3 w-full whitespace-pre-wrap">
                {currentConfig.json}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

