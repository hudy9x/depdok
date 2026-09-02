use rig::tool::PortableTool;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::AppHandle;

use super::bridge::{call_frontend_tool, ToolBridgeError};
use crate::llm2::runtime::PendingRequests;

// RunShellTool
#[derive(Clone)]
pub struct RunShellTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct RunShellArgs {
  pub command: String,
  #[serde(default)]
  pub cwd: Option<String>,
  #[serde(default)]
  pub timeout_ms: Option<u64>,
}

impl PortableTool for RunShellTool {
  const NAME: &'static str = "run_shell";
  type Error = ToolBridgeError;
  type Args = RunShellArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Execute a shell / terminal command in the workspace directory across Windows, Linux, and macOS. Returns stdout, stderr, exit_code, and success status.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "command": {
          "type": "string",
          "description": "The shell command line string to execute (e.g. 'git status', 'npm test', 'cargo check', 'ls -la', 'dir')."
        },
        "cwd": {
          "type": "string",
          "description": "Optional working directory relative to workspace root or absolute path. Defaults to the workspace root directory."
        },
        "timeout_ms": {
          "type": "number",
          "description": "Optional execution timeout in milliseconds (e.g. 30000 for 30 seconds). Defaults to 30000ms."
        }
      },
      "required": ["command"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}
