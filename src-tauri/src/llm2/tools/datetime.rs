use rig::tool::PortableTool;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::AppHandle;

use super::bridge::{call_frontend_tool, ToolBridgeError};
use crate::llm2::runtime::PendingRequests;

// GetCurrentDatetimeTool
#[derive(Clone)]
pub struct GetCurrentDatetimeTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize, Default)]
pub struct GetCurrentDatetimeArgs {
  #[serde(default)]
  pub format: Option<String>,
}

impl PortableTool for GetCurrentDatetimeTool {
  const NAME: &'static str = "get_current_datetime";
  type Error = ToolBridgeError;
  type Args = GetCurrentDatetimeArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Get the current system date, time, timezone, and formatted timestamps (e.g. 'yyyyMMdd-HHmm' for file naming).".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "format": {
          "type": "string",
          "description": "Optional custom format token string (e.g. 'yyyyMMdd-HHmm', 'yyyy-MM-dd', 'HH:mm:ss'). Defaults to 'yyyy-MM-dd HH:mm:ss'."
        }
      }
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}
