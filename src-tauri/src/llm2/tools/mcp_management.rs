use rig::tool::PortableTool;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

use super::bridge::ToolBridgeError;
use crate::mcp_client::{McpClientManager, McpConfigFile, McpServerConfig};

// 1. McpVerifyConfigTool
#[derive(Clone)]
pub struct McpVerifyConfigTool {
  pub app: AppHandle,
}

#[derive(Debug, Deserialize, Serialize, Default)]
pub struct McpVerifyConfigArgs {
  #[serde(default, alias = "raw_json", alias = "json", alias = "config", alias = "content")]
  pub config_json: Option<String>,
  #[serde(default, alias = "workspace", alias = "workspace_path", alias = "root")]
  pub workspace_root: Option<String>,
}

impl PortableTool for McpVerifyConfigTool {
  const NAME: &'static str = "mcp_verify_config";
  type Error = ToolBridgeError;
  type Args = McpVerifyConfigArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Verify and validate an MCP configuration snippet or existing .depdok/settings.json file. Checks JSON syntax, schema rules (command, args, env, url, headers), path validity, and Windows-specific command availability.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "config_json": {
          "type": "string",
          "description": "Optional raw JSON string of the configuration (or 'mcpServers' object) to validate. If omitted, validates the workspace's active .depdok/settings.json."
        },
        "workspace_root": {
          "type": "string",
          "description": "Optional workspace root directory path. Defaults to the current active workspace."
        }
      }
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    let log_id = Uuid::new_v4().to_string();
    let req_id = Uuid::new_v4().to_string();
    let args_val = serde_json::to_value(&args).unwrap_or_default();

    let _ = self.app.emit("tool_log_event", json!({
      "id": log_id,
      "requestId": req_id,
      "toolName": Self::NAME,
      "args": args_val,
      "status": "executing",
      "timestamp": chrono::Utc::now().to_rfc3339()
    }));

    let ws_root = args.workspace_root.as_deref().unwrap_or(".");
    let res = McpConfigFile::verify(args.config_json.as_deref(), ws_root);

    let _ = self.app.emit("tool_log_event", json!({
      "id": log_id,
      "requestId": req_id,
      "toolName": Self::NAME,
      "args": args_val,
      "result": &res,
      "status": "success",
      "timestamp": chrono::Utc::now().to_rfc3339()
    }));

    Ok(res)
  }
}

// 2. McpTestServerTool
#[derive(Clone)]
pub struct McpTestServerTool {
  pub app: AppHandle,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct McpTestServerArgs {
  pub server_name: String,
  #[serde(default)]
  pub config_json: Option<String>,
  #[serde(default)]
  pub workspace_root: Option<String>,
}

impl PortableTool for McpTestServerTool {
  const NAME: &'static str = "mcp_test_server";
  type Error = ToolBridgeError;
  type Args = McpTestServerArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Test connecting to an MCP server, completing the MCP handshake (initialize and tools/list), and discovering exposed tools. Captures detailed error messages and stderr if the connection fails.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "server_name": {
          "type": "string",
          "description": "The name of the MCP server to test (from .depdok/settings.json or a custom name)."
        },
        "config_json": {
          "type": "string",
          "description": "Optional inline JSON string of the server config (e.g. '{\"command\": \"node\", \"args\": [\"./server.js\"]}') to test without saving first."
        },
        "workspace_root": {
          "type": "string",
          "description": "Optional workspace root directory path. Defaults to the current active workspace."
        }
      },
      "required": ["server_name"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    let log_id = Uuid::new_v4().to_string();
    let req_id = Uuid::new_v4().to_string();
    let args_val = serde_json::to_value(&args).unwrap_or_default();

    let _ = self.app.emit("tool_log_event", json!({
      "id": log_id,
      "requestId": req_id,
      "toolName": Self::NAME,
      "args": args_val,
      "status": "executing",
      "timestamp": chrono::Utc::now().to_rfc3339()
    }));

    let ws_root = args.workspace_root.as_deref().unwrap_or(".");
    let mut server_cfg = if let Some(raw) = &args.config_json {
      match serde_json::from_str::<McpServerConfig>(raw) {
        Ok(cfg) => cfg,
        Err(e) => {
          let err_msg = format!("Failed to parse inline config_json: {}", e);
          let _ = self.app.emit("tool_log_event", json!({
            "id": log_id,
            "requestId": req_id,
            "toolName": Self::NAME,
            "args": args_val,
            "error": &err_msg,
            "status": "error",
            "timestamp": chrono::Utc::now().to_rfc3339()
          }));
          return Err(ToolBridgeError(err_msg));
        }
      }
    } else {
      let file_cfg = McpConfigFile::load_for_workspace(ws_root);
      match file_cfg.mcp_servers.get(&args.server_name) {
        Some(cfg) => cfg.clone(),
        None => {
          let err_msg = format!(
            "No MCP server named '{}' found in workspace configuration.",
            args.server_name
          );
          let _ = self.app.emit("tool_log_event", json!({
            "id": log_id,
            "requestId": req_id,
            "toolName": Self::NAME,
            "args": args_val,
            "error": &err_msg,
            "status": "error",
            "timestamp": chrono::Utc::now().to_rfc3339()
          }));
          return Err(ToolBridgeError(err_msg));
        }
      }
    };

    server_cfg.normalize_for_workspace(ws_root);

    match McpClientManager::test_connection(&args.server_name, &server_cfg).await {
      Ok(res) => {
        let _ = self.app.emit("tool_log_event", json!({
          "id": log_id,
          "requestId": req_id,
          "toolName": Self::NAME,
          "args": args_val,
          "result": &res,
          "status": "success",
          "timestamp": chrono::Utc::now().to_rfc3339()
        }));
        Ok(res)
      }
      Err(err) => {
        let _ = self.app.emit("tool_log_event", json!({
          "id": log_id,
          "requestId": req_id,
          "toolName": Self::NAME,
          "args": args_val,
          "error": &err,
          "status": "error",
          "timestamp": chrono::Utc::now().to_rfc3339()
        }));
        Err(ToolBridgeError(err))
      }
    }
  }
}

// 3. McpListServersTool
#[derive(Clone)]
pub struct McpListServersTool {
  pub app: AppHandle,
}

#[derive(Debug, Deserialize, Serialize, Default)]
pub struct McpListServersArgs {}

impl PortableTool for McpListServersTool {
  const NAME: &'static str = "mcp_list_servers";
  type Error = ToolBridgeError;
  type Args = McpListServersArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "List all currently configured and connected MCP servers in the app runtime, transport types, connection status ('connected', 'error', 'disconnected'), and discovered tool names.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {}
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    let log_id = Uuid::new_v4().to_string();
    let req_id = Uuid::new_v4().to_string();
    let args_val = serde_json::to_value(&args).unwrap_or_default();

    let _ = self.app.emit("tool_log_event", json!({
      "id": log_id,
      "requestId": req_id,
      "toolName": Self::NAME,
      "args": args_val,
      "status": "executing",
      "timestamp": chrono::Utc::now().to_rfc3339()
    }));

    let mcp_manager = self.app.try_state::<McpClientManager>();
    let summaries = if let Some(mgr) = &mcp_manager {
      mgr.list_servers().await
    } else {
      Vec::new()
    };

    let res = json!({
      "count": summaries.len(),
      "servers": summaries
    });

    let _ = self.app.emit("tool_log_event", json!({
      "id": log_id,
      "requestId": req_id,
      "toolName": Self::NAME,
      "args": args_val,
      "result": &res,
      "status": "success",
      "timestamp": chrono::Utc::now().to_rfc3339()
    }));

    Ok(res)
  }
}

// 4. McpReloadTool
#[derive(Clone)]
pub struct McpReloadTool {
  pub app: AppHandle,
}

#[derive(Debug, Deserialize, Serialize, Default)]
pub struct McpReloadArgs {
  #[serde(default, alias = "workspace", alias = "workspace_path", alias = "root")]
  pub workspace_root: Option<String>,
}

impl PortableTool for McpReloadTool {
  const NAME: &'static str = "mcp_reload";
  type Error = ToolBridgeError;
  type Args = McpReloadArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Reload and reconnect all MCP servers configured in .depdok/settings.json (or .depdok/mcp.json) for the active workspace. Discovers updated tools and returns their statuses.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "workspace_root": {
          "type": "string",
          "description": "Optional workspace root directory path. Defaults to the current active workspace."
        }
      }
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    let log_id = Uuid::new_v4().to_string();
    let req_id = Uuid::new_v4().to_string();
    let args_val = serde_json::to_value(&args).unwrap_or_default();

    let _ = self.app.emit("tool_log_event", json!({
      "id": log_id,
      "requestId": req_id,
      "toolName": Self::NAME,
      "args": args_val,
      "status": "executing",
      "timestamp": chrono::Utc::now().to_rfc3339()
    }));

    let ws_root = args.workspace_root.as_deref().unwrap_or(".");
    let mcp_manager = self.app.try_state::<McpClientManager>();

    if let Some(mgr) = &mcp_manager {
      match mgr.reload_for_workspace(ws_root).await {
        Ok(summaries) => {
          let connected_count = summaries.iter().filter(|s| s.status == "connected").count();
          let total_tools: usize = summaries.iter().map(|s| s.tools_count).sum();
          let res = json!({
            "success": true,
            "total_servers": summaries.len(),
            "connected_servers": connected_count,
            "total_tools": total_tools,
            "servers": summaries
          });

          let _ = self.app.emit("tool_log_event", json!({
            "id": log_id,
            "requestId": req_id,
            "toolName": Self::NAME,
            "args": args_val,
            "result": &res,
            "status": "success",
            "timestamp": chrono::Utc::now().to_rfc3339()
          }));

          Ok(res)
        }
        Err(err) => {
          let _ = self.app.emit("tool_log_event", json!({
            "id": log_id,
            "requestId": req_id,
            "toolName": Self::NAME,
            "args": args_val,
            "error": &err,
            "status": "error",
            "timestamp": chrono::Utc::now().to_rfc3339()
          }));
          Err(ToolBridgeError(err))
        }
      }
    } else {
      let err_msg = "McpClientManager is not initialized".to_string();
      let _ = self.app.emit("tool_log_event", json!({
        "id": log_id,
        "requestId": req_id,
        "toolName": Self::NAME,
        "args": args_val,
        "error": &err_msg,
        "status": "error",
        "timestamp": chrono::Utc::now().to_rfc3339()
      }));
      Err(ToolBridgeError(err_msg))
    }
  }
}

