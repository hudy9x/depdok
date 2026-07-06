use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_store::StoreExt;

use super::engine::LlamaEngine;
use super::models::{self, GgufModelInfo};
use super::provider::{LlmConfig, LlmProviderStatus, LlmState, ProviderType};
use super::remote::{self, ChatMessage};
use super::session::{
    self, ChatSession, ChatSessionMeta, PersistedMessage,
};
use super::tools;
use chrono::Utc;
use serde_json::Value;

// ─── Config Commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_llm_config(
    app: AppHandle,
    state: State<'_, LlmState>,
) -> Result<LlmConfig, String> {
    // Try loading from persistent store first
    if let Ok(store) = app.store("store.json") {
        if let Some(val) = store.get("llm_config") {
            if let Ok(config) = serde_json::from_value::<LlmConfig>(val) {
                // Sync in-memory config
                *state.config.lock().unwrap() = config.clone();
                return Ok(config);
            }
        }
    }
    Ok(state.config.lock().unwrap().clone())
}

#[tauri::command]
pub fn save_llm_config(
    app: AppHandle,
    state: State<'_, LlmState>,
    config: LlmConfig,
) -> Result<(), String> {
    // Persist to store
    if let Ok(store) = app.store("store.json") {
        let json =
            serde_json::to_value(&config).map_err(|e| format!("Serialize error: {}", e))?;
        let _ = store.set("llm_config", json);
        let _ = store.save();
    }
    *state.config.lock().unwrap() = config;
    Ok(())
}

// ─── Provider Commands ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn load_llm_provider(
    state: State<'_, LlmState>,
) -> Result<(), String> {
    let config = state.config.lock().unwrap().clone();

    match config.provider_type {
        ProviderType::Local => {
            let model_path = config
                .local_model_path
                .clone()
                .ok_or("No local model path configured")?;

            let llama_config = config.to_llama_config();

            // Load engine in blocking task to avoid blocking async executor
            let engine = tokio::task::spawn_blocking(move || {
                LlamaEngine::load(&model_path, llama_config)
                    .map_err(|e| e.to_string())
            })
            .await
            .map_err(|e| format!("Task error: {}", e))??;

            *state.engine.lock().unwrap() = Some(Arc::new(engine));
        }
        // Remote providers don't need pre-loading
        _ => {
            *state.engine.lock().unwrap() = None;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn unload_llm_provider(state: State<'_, LlmState>) -> Result<(), String> {
    *state.engine.lock().unwrap() = None;
    Ok(())
}

#[tauri::command]
pub fn get_llm_provider_status(state: State<'_, LlmState>) -> LlmProviderStatus {
    let engine = state.engine.lock().unwrap();
    let config = state.config.lock().unwrap();
    LlmProviderStatus {
        loaded: engine.is_some()
            || !matches!(config.provider_type, ProviderType::Local),
        provider_type: config.provider_type.clone(),
        model_name: config.model_name.clone().or_else(|| {
            config
                .local_model_path
                .as_ref()
                .and_then(|p| std::path::Path::new(p).file_name())
                .map(|n| n.to_string_lossy().to_string())
        }),
    }
}

// ─── Chat Command ─────────────────────────────────────────────────────────────

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct SendChatMessageArgs {
    pub messages: Vec<ChatMessage>,
    pub workspace_root: String,
    pub session_id: String,
}

#[tauri::command]
pub async fn send_chat_message(
    app: AppHandle,
    state: State<'_, LlmState>,
    messages: Vec<ChatMessage>,
    workspace_root: String,
    session_id: String,
) -> Result<(), String> {
    // Reset cancel flag
    state.cancel.store(false, Ordering::Relaxed);

    let config = state.config.lock().unwrap().clone();
    let cancel = Arc::clone(&state.cancel);
    let tool_defs = tools::get_tool_definitions();

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

    match &config.provider_type {
        ProviderType::Local => {
            let engine = {
                let guard = state.engine.lock().unwrap();
                guard.clone().ok_or("Local model not loaded. Please load a model first.")?
            };

            let prompt = build_chat_prompt(&messages, config.system_prompt.as_deref());
            let app2 = app.clone();
            let cancel2 = Arc::clone(&cancel);

            tokio::task::spawn_blocking(move || {
                engine.stream(&prompt, |piece| {
                    let _ = app2.emit("llm-token", piece);
                    Ok(!cancel2.load(Ordering::Relaxed))
                })
            })
            .await
            .map_err(|e| format!("Task join error: {}", e))?
            .map_err(|e| e.to_string())?;

            let _ = app.emit("llm-done", ());
        }

        ProviderType::Ollama => {
            let endpoint = config
                .api_endpoint
                .clone()
                .unwrap_or_else(|| "http://localhost:11434".to_string());
            let model = config.model_name.clone().unwrap_or_else(|| "llama3".to_string());
            remote::stream_openai_compatible(
                &endpoint,
                &model,
                None,
                &messages,
                &tool_defs,
                &app,
                cancel,
            )
            .await?;
        }

        ProviderType::LmStudio => {
            let endpoint = config
                .api_endpoint
                .clone()
                .unwrap_or_else(|| "http://localhost:1234".to_string());
            let model = config.model_name.clone().unwrap_or_else(|| "local-model".to_string());
            remote::stream_openai_compatible(
                &endpoint,
                &model,
                None,
                &messages,
                &tool_defs,
                &app,
                cancel,
            )
            .await?;
        }

        ProviderType::OpenAI => {
            let endpoint = config
                .api_endpoint
                .clone()
                .unwrap_or_else(|| "https://api.openai.com".to_string());
            let model = config.model_name.clone().unwrap_or_else(|| "gpt-4o".to_string());
            let key = config.api_key.clone();
            remote::stream_openai_compatible(
                &endpoint,
                &model,
                key.as_deref(),
                &messages,
                &tool_defs,
                &app,
                cancel,
            )
            .await?;
        }

        ProviderType::Claude => {
            let key = config
                .api_key
                .clone()
                .ok_or("No API key configured for Claude")?;
            let model = config
                .model_name
                .clone()
                .unwrap_or_else(|| "claude-3-5-sonnet-20241022".to_string());
            remote::stream_claude(
                &key,
                &model,
                &messages,
                config.system_prompt.as_deref(),
                &tool_defs,
                &app,
                cancel,
            )
            .await?;
        }
    }

    Ok(())
}

/// Execute a tool call requested by the LLM. Called from the frontend after
/// receiving an `llm-tool-call-pending` event.
#[tauri::command]
pub fn execute_llm_tool(
    name: String,
    args_json: String,
    workspace_root: String,
) -> Result<String, String> {
    let args: Value =
        serde_json::from_str(&args_json).map_err(|e| format!("Invalid args JSON: {}", e))?;
    tools::execute_tool(&name, &args, &workspace_root)
}

#[tauri::command]
pub fn cancel_generation(state: State<'_, LlmState>) -> Result<(), String> {
    state.cancel.store(true, Ordering::Relaxed);
    Ok(())
}

// ─── Session Commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_chat_sessions(workspace_root: String) -> Result<Vec<ChatSessionMeta>, String> {
    session::list_sessions(&workspace_root)
}

#[tauri::command]
pub fn load_chat_session(
    workspace_root: String,
    session_id: String,
) -> Result<ChatSession, String> {
    session::load_session(&workspace_root, &session_id)
}

#[tauri::command]
pub fn delete_chat_session(
    workspace_root: String,
    session_id: String,
) -> Result<(), String> {
    session::delete_session(&workspace_root, &session_id)
}

// ─── Model Commands ───────────────────────────────────────────────────────────

#[tauri::command]
pub fn scan_local_llm_models(app: AppHandle) -> Result<Vec<GgufModelInfo>, String> {
    models::scan_models(&app)
}

#[tauri::command]
pub async fn download_llm_model(
    app: AppHandle,
    url: String,
    filename: String,
) -> Result<(), String> {
    models::download_model(app, url, filename).await
}

#[tauri::command]
pub fn delete_llm_model(app: AppHandle, filename: String) -> Result<(), String> {
    models::delete_model(&app, &filename)
}

#[tauri::command]
pub fn reveal_llm_models_dir(app: AppHandle) -> Result<(), String> {
    models::reveal_models_dir(&app)
}

#[tauri::command]
pub fn get_llm_models_dir(app: AppHandle) -> Result<String, String> {
    models::get_models_dir(&app)
        .map(|p| p.to_string_lossy().to_string())
}

// ─── Grammar Correction Command ───────────────────────────────────────────────

#[tauri::command]
pub async fn grammar_correct_text(
    text: String,
    state: State<'_, LlmState>,
) -> Result<String, String> {
    let prompt = format!(
        "Fix the grammar and style of the following text. \
         Return ONLY the corrected text with no explanation, \
         no quotes, and no extra commentary:\n\n{text}"
    );

    let config = state.config.lock().unwrap().clone();

    match config.provider_type {
        ProviderType::Local => {
            let engine = state
                .engine
                .lock()
                .unwrap()
                .clone()
                .ok_or("No local model loaded")?;

            let result = tokio::task::spawn_blocking(move || {
                engine.generate(&prompt).map_err(|e| e.to_string())
            })
            .await
            .map_err(|e| format!("Task join error: {}", e))??;

            Ok(result.trim().to_string())
        }
        ProviderType::Ollama => {
            let endpoint = config
                .api_endpoint
                .unwrap_or_else(|| "http://localhost:11434".to_string());
            let model = config.model_name.unwrap_or_else(|| "llama3".to_string());
            call_openai_compat_single(&endpoint, &model, None, &prompt).await
        }
        ProviderType::LmStudio => {
            let endpoint = config
                .api_endpoint
                .unwrap_or_else(|| "http://localhost:1234".to_string());
            let model = config.model_name.unwrap_or_else(|| "local-model".to_string());
            call_openai_compat_single(&endpoint, &model, None, &prompt).await
        }
        ProviderType::OpenAI => {
            let endpoint = config
                .api_endpoint
                .unwrap_or_else(|| "https://api.openai.com".to_string());
            let model = config.model_name.unwrap_or_else(|| "gpt-4o".to_string());
            let key = config.api_key;
            call_openai_compat_single(&endpoint, &model, key.as_deref(), &prompt).await
        }
        ProviderType::Claude => {
            let key = config
                .api_key
                .ok_or("No Claude API key configured")?;
            let model = config
                .model_name
                .unwrap_or_else(|| "claude-3-5-sonnet-20241022".to_string());
            call_claude_single(&key, &model, &prompt).await
        }
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/// Build a simple chat prompt string for local llama (no special tool support).
fn build_chat_prompt(messages: &[ChatMessage], system_prompt: Option<&str>) -> String {
    let mut prompt = String::new();

    if let Some(sys) = system_prompt {
        prompt.push_str(&format!("<|system|>\n{sys}\n"));
    }

    for msg in messages {
        match msg.role.as_str() {
            "user" => prompt.push_str(&format!("<|user|>\n{}\n<|assistant|>\n", msg.content)),
            "assistant" => prompt.push_str(&format!("{}\n", msg.content)),
            _ => {}
        }
    }

    prompt
}

/// Single (non-streaming) OpenAI-compatible chat completion.
async fn call_openai_compat_single(
    endpoint: &str,
    model: &str,
    api_key: Option<&str>,
    prompt: &str,
) -> Result<String, String> {
    use serde_json::json;

    let client = reqwest::Client::new();
    let url = format!("{}/v1/chat/completions", endpoint.trim_end_matches('/'));

    let body = json!({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": false,
    });

    let mut req = client.post(&url).json(&body);
    if let Some(key) = api_key {
        if !key.is_empty() {
            req = req.bearer_auth(key);
        }
    }

    let resp = req.send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, text));
    }

    let json: Value = resp.json().await.map_err(|e| e.to_string())?;
    json["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "No content in response".to_string())
}

/// Single (non-streaming) Claude API call.
async fn call_claude_single(api_key: &str, model: &str, prompt: &str) -> Result<String, String> {
    use serde_json::json;

    let client = reqwest::Client::new();
    let body = json!({
        "model": model,
        "max_tokens": 2048,
        "messages": [{"role": "user", "content": prompt}],
    });

    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Claude HTTP {}: {}", status, text));
    }

    let json: Value = resp.json().await.map_err(|e| e.to_string())?;
    json["content"][0]["text"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "No content in Claude response".to_string())
}
