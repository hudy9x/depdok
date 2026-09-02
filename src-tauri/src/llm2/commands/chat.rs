use tauri::{AppHandle, State};

use crate::llm2::agent::prompt_agent;
use crate::llm2::runtime::{PendingRequests, ToolResultResponse};
use crate::llm2::types::OllamaMessage;

#[tauri::command]
pub async fn llm2_send_message(
  prompt: String,
  model: Option<String>,
  content_model: Option<String>,
  message_id: Option<String>,
  history: Option<Vec<OllamaMessage>>,
  num_ctx: Option<usize>,
  system_prompt_addendum: Option<String>,
  allowed_tools: Option<Vec<String>>,
  think: Option<bool>,
  auto_compact: Option<bool>,
  sliding_window: Option<bool>,
  state: State<'_, PendingRequests>,
  app: AppHandle,
) -> Result<String, String> {
  let pending = (*state).clone();
  prompt_agent(
    app,
    pending,
    &prompt,
    model,
    content_model,
    message_id,
    history,
    num_ctx,
    system_prompt_addendum,
    allowed_tools,
    think,
    auto_compact,
    sliding_window,
  )
  .await
}

#[tauri::command]
pub fn llm2_tool_result(
  request_id: String,
  result: ToolResultResponse,
  state: State<'_, PendingRequests>,
) -> Result<(), String> {
  state.resolve(&request_id, result);
  Ok(())
}

#[tauri::command]
pub fn llm2_cancel_generation(
  message_id: Option<String>,
  state: State<'_, PendingRequests>,
) -> Result<(), String> {
  println!("[llm2][command] llm2_cancel_generation requested for message_id: {:?}", message_id);
  state.cancel(message_id.as_deref());
  Ok(())
}
