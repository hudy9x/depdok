use serde::{Deserialize, Serialize};
use std::fmt::Display;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::llm2::runtime::PendingRequests;

#[derive(Debug)]
pub struct ToolBridgeError(pub String);

impl Display for ToolBridgeError {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    write!(f, "{}", self.0)
  }
}

impl std::error::Error for ToolBridgeError {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolRequestPayload {
  pub request_id: String,
  pub tool_name: String,
  pub args: serde_json::Value,
}

pub async fn call_frontend_tool<Args: Serialize>(
  app: &AppHandle,
  pending: &PendingRequests,
  tool_name: &str,
  args: Args,
) -> Result<serde_json::Value, ToolBridgeError> {
  call_frontend_tool_with_timeout(app, pending, tool_name, args, Duration::from_secs(60)).await
}

pub async fn call_frontend_tool_with_timeout<Args: Serialize>(
  app: &AppHandle,
  pending: &PendingRequests,
  tool_name: &str,
  args: Args,
  timeout_duration: Duration,
) -> Result<serde_json::Value, ToolBridgeError> {
  let request_id = Uuid::new_v4().to_string();
  let (tx, rx) = tokio::sync::oneshot::channel();

  pending.insert(request_id.clone(), tx);

  let args_val = serde_json::to_value(args)
    .map_err(|e| ToolBridgeError(format!("Failed to serialize tool args: {}", e)))?;

  let payload = ToolRequestPayload {
    request_id: request_id.clone(),
    tool_name: tool_name.to_string(),
    args: args_val,
  };

  // Emit event to React frontend
  if let Err(e) = app.emit("tool_request", &payload) {
    pending.remove(&request_id);
    return Err(ToolBridgeError(format!("Failed to emit event to frontend: {}", e)));
  }

  // Await response from React with specified timeout safeguard
  match tokio::time::timeout(timeout_duration, rx).await {
    Ok(Ok(Ok(val))) => Ok(val),
    Ok(Ok(Err(err_msg))) => Err(ToolBridgeError(format!("Frontend error: {}", err_msg))),
    Ok(Err(_)) => Err(ToolBridgeError("Channel closed unexpectedly".to_string())),
    Err(_) => {
      pending.remove(&request_id);
      Err(ToolBridgeError(format!(
        "Tool execution timed out after {} seconds",
        timeout_duration.as_secs()
      )))
    }
  }
}
