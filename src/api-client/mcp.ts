import { invoke } from "@tauri-apps/api/core";

export const getMcpServerPaths = (): Promise<string[]> =>
  invoke("get_mcp_server_paths");
