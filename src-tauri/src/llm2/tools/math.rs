use rig::tool::PortableTool;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::AppHandle;

use super::bridge::{call_frontend_tool, ToolBridgeError};
use crate::llm2::pending::PendingRequests;

// 5. SumFourDigitsTool
#[derive(Clone)]
pub struct SumFourDigitsTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SumFourDigitsArgs {
  pub a: f64,
  pub b: f64,
  pub c: f64,
  pub d: f64,
}

impl PortableTool for SumFourDigitsTool {
  const NAME: &'static str = "sum_four_digits";
  type Error = ToolBridgeError;
  type Args = SumFourDigitsArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Calculate the sum of four numbers (a, b, c, d).".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "a": { "type": "number", "description": "First number" },
        "b": { "type": "number", "description": "Second number" },
        "c": { "type": "number", "description": "Third number" },
        "d": { "type": "number", "description": "Fourth number" }
      },
      "required": ["a", "b", "c", "d"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}
