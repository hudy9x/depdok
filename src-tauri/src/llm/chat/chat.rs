use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::{AppHandle, State};
use serde_json::Value;
use chrono::Utc;

use crate::llm::provider::LlmState;
use crate::llm::remote::ChatMessage;
use crate::llm::session::{self, ChatSession, PersistedMessage};
use crate::llm::providers::get_provider;
use crate::llm::tools;

#[tauri::command]
pub async fn send_chat_message(
    app: AppHandle,
    state: State<'_, LlmState>,
    messages: Vec<ChatMessage>,
    workspace_root: String,
    session_id: String,
) -> Result<(), String> {
    println!(
        "[llm][command] send_chat_message for session: {}, messages count: {}",
        session_id,
        messages.len()
    );
    // Reset cancel flag
    state.cancel.store(false, Ordering::Relaxed);

    // Bootstraps state from disk store if config hasn't been loaded in memory yet
    let config = crate::llm::settings::config::load_config_internal(&app, &state);
    let cancel = Arc::clone(&state.cancel);

    // Persist the new user messages before generation
    let provider_name = format!("{:?}", config.provider_type).to_lowercase();
    let model_name = config.model_name.clone().or_else(|| {
        config
            .local_model_path
            .as_ref()
            .and_then(|p| std::path::Path::new(p).file_name())
            .map(|n| n.to_string_lossy().to_string())
    });

    let now = Utc::now().to_rfc3339();
    let persisted_msgs: Vec<PersistedMessage> = messages
        .iter()
        .map(|m| PersistedMessage {
            role: m.role.clone(),
            content: m.content.clone(),
            timestamp: now.clone(),
            name: m.name.clone(),
            tool_input: None,
            tool_output: None,
        })
        .collect();

    let session = ChatSession {
        id: session_id.clone(),
        created_at: now.clone(),
        model: model_name.clone(),
        provider: provider_name.clone(),
        messages: persisted_msgs,
    };
    // Best-effort session save; don't fail the whole command on I/O error
    let _ = session::save_session(&workspace_root, &session);

    println!(
        "[llm][chat] Resolving provider for streaming (type: {:?}, model: {:?})",
        config.provider_type,
        model_name
    );
    let provider = get_provider(&config, &state).await?;
    provider.stream(&messages, &config, &app, cancel).await
}

#[tauri::command]
pub fn execute_llm_tool(
    name: String,
    args_json: String,
    workspace_root: String,
) -> Result<String, String> {
    println!("[llm][command] execute_llm_tool: name={}, args={}", name, args_json);
    let args: Value =
        serde_json::from_str(&args_json).map_err(|e| format!("Invalid args JSON: {}", e))?;
    let result = tools::execute_tool(&name, &args, &workspace_root);
    match &result {
        Ok(out) => println!("[llm][tool] Tool execution succeeded: {} bytes returned", out.len()),
        Err(err) => println!("[llm][tool] Tool execution failed: {}", err),
    }
    result
}

#[tauri::command]
pub fn cancel_generation(state: State<'_, LlmState>) -> Result<(), String> {
    println!("[llm][command] cancel_generation requested");
    state.cancel.store(true, Ordering::Relaxed);
    Ok(())
}
