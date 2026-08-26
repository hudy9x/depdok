import React, { useEffect, useCallback, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import {
  Blocks,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Terminal,
  Globe,
  HelpCircle,
  Power,
  PowerOff,
  Loader2,
  CircleDot,
} from "lucide-react";
import { workspaceRootAtom } from "@/features/FileExplorer/store";
import {
  listMcpServers,
  reloadMcpServers,
  disconnectMcpServer,
  connectMcpServer,
  McpServerSummary,
} from "@/api-client/mcp";
import { mcpServersAtom, isReloadingMcpAtom } from "../store/LLMChat2Store";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface McpStatusPopoverProps {
  className?: string;
}

export const McpStatusPopover: React.FC<McpStatusPopoverProps> = ({ className = "" }) => {
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const [servers, setServers] = useAtom(mcpServersAtom);
  const [isReloading, setIsReloading] = useAtom(isReloadingMcpAtom);
  const [actionLoadingServer, setActionLoadingServer] = useState<string | null>(null);

  const fetchServers = useCallback(async () => {
    try {
      const list = await listMcpServers();
      setServers(list);
    } catch (e) {
      console.error("[McpStatusPopover] Failed to list MCP servers:", e);
    }
  }, [setServers]);

  const handleReload = useCallback(async () => {
    if (!workspaceRoot) {
      await fetchServers();
      return;
    }
    setIsReloading(true);
    try {
      const list = await reloadMcpServers(workspaceRoot);
      setServers(list);
    } catch (e) {
      console.error("[McpStatusPopover] Failed to reload MCP servers:", e);
      await fetchServers();
    } finally {
      setIsReloading(false);
    }
  }, [workspaceRoot, fetchServers, setIsReloading, setServers]);

  const handleDisconnect = async (serverName: string) => {
    setActionLoadingServer(serverName);
    try {
      const updated = await disconnectMcpServer(serverName);
      setServers(updated);
    } catch (e) {
      console.error("[McpStatusPopover] Failed to disconnect server:", e);
    } finally {
      setActionLoadingServer(null);
    }
  };

  const handleConnect = async (serverName: string) => {
    if (!workspaceRoot) return;
    setActionLoadingServer(serverName);
    try {
      const updated = await connectMcpServer(workspaceRoot, serverName);
      setServers(updated);
    } catch (e) {
      console.error("[McpStatusPopover] Failed to connect server:", e);
      await fetchServers();
    } finally {
      setActionLoadingServer(null);
    }
  };

  // Initial fetch and workspace root change reload
  useEffect(() => {
    if (workspaceRoot) {
      handleReload();
    } else {
      fetchServers();
    }
  }, [workspaceRoot, fetchServers, handleReload]);

  const hasErrors = servers.some((s) => s.status === "error" || s.error);
  const connectedCount = servers.filter((s) => s.status === "connected" && !s.error).length;
  const totalToolsCount = servers
    .filter((s) => s.status === "connected")
    .reduce((acc, s) => acc + (s.tools_count || 0), 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`relative p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer ${className}`}
          title={`MCP Servers (${connectedCount} ready, ${totalToolsCount} tools)`}
        >
          <Blocks className="h-3 w-3" />
          {/* Status Indicator Dot */}
          {servers.length > 0 && (
            <span
              className={`absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-background ${
                hasErrors
                  ? "bg-red-500 animate-pulse"
                  : connectedCount > 0
                  ? "bg-emerald-500"
                  : "bg-muted-foreground/50"
              }`}
            />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        className="w-84 p-0 overflow-hidden bg-popover/95 backdrop-blur-xl border border-border/60 shadow-2xl rounded-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/40 border-b border-border/50">
          <div className="flex items-center gap-1.5">
            <Blocks className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">MCP Servers</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-muted text-muted-foreground border border-border/40">
              {servers.length}
            </span>
          </div>

          <button
            onClick={handleReload}
            disabled={isReloading}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer disabled:opacity-50"
            title="Reload servers and rediscover tools"
          >
            <RefreshCw className={`h-3 w-3 ${isReloading ? "animate-spin text-primary" : ""}`} />
            <span>{isReloading ? "Reloading..." : "Reload"}</span>
          </button>
        </div>

        {/* Server List */}
        <div className="max-h-80 overflow-y-auto p-2.5 space-y-2">
          {servers.length === 0 ? (
            <div className="py-6 px-3 text-center space-y-2">
              <HelpCircle className="h-6 w-6 text-muted-foreground/50 mx-auto" />
              <div className="text-xs font-medium text-foreground">No MCP servers connected</div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Add server configurations to <code className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">.depdok/settings.json</code> or type <span className="font-semibold text-primary">/mcp-setup</span> in chat.
              </p>
            </div>
          ) : (
            servers.map((server) => (
              <ServerCard
                key={server.name}
                server={server}
                isLoading={actionLoadingServer === server.name}
                onConnect={() => handleConnect(server.name)}
                onDisconnect={() => handleDisconnect(server.name)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 bg-muted/20 border-t border-border/40 text-[10px] text-muted-foreground flex items-center justify-between">
          <span>{totalToolsCount} tool{totalToolsCount === 1 ? "" : "s"} ready for AI calling</span>
          <span className="text-[9px] opacity-70">JSON-RPC 2.0</span>
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface ServerCardProps {
  server: McpServerSummary;
  isLoading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

const ServerCard: React.FC<ServerCardProps> = ({
  server,
  isLoading,
  onConnect,
  onDisconnect,
}) => {
  const isConnected = server.status === "connected" && !server.error;
  const isDisconnected = server.status === "disconnected";
  const isError = server.status === "error" || Boolean(server.error);

  return (
    <div
      className={`p-2.5 rounded-lg border transition-colors space-y-2 shadow-xs ${
        isDisconnected
          ? "border-border/30 bg-muted/20 opacity-75"
          : "border-border/50 bg-background/60 hover:bg-background/90"
      }`}
    >
      {/* Title row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {server.transport_type === "http" ? (
            <Globe className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          ) : (
            <Terminal className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          )}
          <span className="text-xs font-semibold text-foreground truncate font-mono">
            {server.name}
          </span>
          <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-muted text-muted-foreground font-mono">
            {server.transport_type}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Status badge */}
          {isConnected && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
              <CheckCircle2 className="h-2.5 w-2.5" />
              Ready
            </span>
          )}
          {isDisconnected && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md border border-border/40">
              <CircleDot className="h-2.5 w-2.5" />
              Off
            </span>
          )}
          {isError && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-md border border-red-500/20">
              <AlertCircle className="h-2.5 w-2.5" />
              Error
            </span>
          )}

          {/* Connect / Disconnect button */}
          {isConnected ? (
            <button
              onClick={onDisconnect}
              disabled={isLoading}
              className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors cursor-pointer disabled:opacity-50"
              title="Disconnect server"
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <PowerOff className="h-3 w-3" />
              )}
            </button>
          ) : (
            <button
              onClick={onConnect}
              disabled={isLoading}
              className="p-1 rounded hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500 transition-colors cursor-pointer disabled:opacity-50"
              title="Connect server"
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Power className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Error display if present */}
      {server.error && (
        <div className="text-[10px] text-red-500 bg-red-500/10 border border-red-500/20 p-1.5 rounded text-left font-mono break-all leading-tight">
          {server.error}
        </div>
      )}

      {/* Tools list */}
      {!isDisconnected && server.tools && server.tools.length > 0 && (
        <div className="space-y-1 pt-0.5">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
            <Wrench className="h-2.5 w-2.5" />
            <span>Tools ({server.tools.length}):</span>
          </div>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {server.tools.map((tool) => (
              <span
                key={tool}
                className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-foreground/80 border border-border/40"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
