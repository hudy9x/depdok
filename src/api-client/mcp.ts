import { invoke } from "@tauri-apps/api/core";

export const getMcpServerPaths = (): Promise<string[]> =>
  invoke("get_mcp_server_paths");

export const checkMcpConfigStatus = (agentId: string, workspaceRoot: string | null): Promise<boolean> =>
  invoke("check_mcp_config_status", { agentId, workspaceRoot });
