use tauri::State;

use crate::mcp_client::{McpClientManager, McpServerSummary};

#[tauri::command]
pub async fn llm2_mcp_reload(
  workspace_root: String,
  state: State<'_, McpClientManager>,
) -> Result<Vec<McpServerSummary>, String> {
  state.reload_for_workspace(&workspace_root).await
}

#[tauri::command]
pub async fn llm2_mcp_list_servers(
  state: State<'_, McpClientManager>,
) -> Result<Vec<McpServerSummary>, String> {
  Ok(state.list_servers().await)
}

#[tauri::command]
pub async fn llm2_mcp_disconnect_server(
  server_name: String,
  state: State<'_, McpClientManager>,
) -> Result<Vec<McpServerSummary>, String> {
  state.disconnect_server(&server_name).await
}

#[tauri::command]
pub async fn llm2_mcp_connect_server(
  workspace_root: String,
  server_name: String,
  state: State<'_, McpClientManager>,
) -> Result<Vec<McpServerSummary>, String> {
  state.connect_server(&workspace_root, &server_name).await
}

#[tauri::command]
pub async fn llm2_mcp_clear_all(
  state: State<'_, McpClientManager>,
) -> Result<(), String> {
  state.clear_all().await;
  Ok(())
}
