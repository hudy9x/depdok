use tauri::{AppHandle, State};
use super::agent::{prompt_agent, OllamaMessage};
use super::pending::{PendingRequests, ToolResultResponse};

#[tauri::command]
pub async fn llm2_send_message(
    prompt: String,
    model: Option<String>,
    message_id: Option<String>,
    history: Option<Vec<OllamaMessage>>,
    num_ctx: Option<usize>,
    state: State<'_, PendingRequests>,
    app: AppHandle,
) -> Result<String, String> {
    let pending = (*state).clone();
    prompt_agent(app, pending, &prompt, model, message_id, history, num_ctx).await
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
