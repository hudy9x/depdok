import { invoke } from "@tauri-apps/api/core";

export interface McpServerSummary {
  name: string;
  transport_type: string;
  status: string; // "connected" | "error" | "disconnected"
  tools_count: number;
  tools: string[];
  error?: string | null;
}

export const getMcpServerPaths = (): Promise<string[]> =>
  invoke("get_mcp_server_paths");

export const checkMcpConfigStatus = (agentId: string, workspaceRoot: string | null): Promise<boolean> =>
  invoke("check_mcp_config_status", { agentId, workspaceRoot });

export const reloadMcpServers = (workspaceRoot: string): Promise<McpServerSummary[]> =>
  invoke("llm2_mcp_reload", { workspaceRoot, workspace_root: workspaceRoot });

export const listMcpServers = (): Promise<McpServerSummary[]> =>
  invoke("llm2_mcp_list_servers");

export const disconnectMcpServer = (serverName: string): Promise<McpServerSummary[]> =>
  invoke("llm2_mcp_disconnect_server", { serverName, server_name: serverName });

export const connectMcpServer = (
  workspaceRoot: string,
  serverName: string
): Promise<McpServerSummary[]> =>
  invoke("llm2_mcp_connect_server", {
    workspaceRoot,
    workspace_root: workspaceRoot,
    serverName,
    server_name: serverName,
  });

export const clearAllMcpServers = (): Promise<void> =>
  invoke("llm2_mcp_clear_all");


