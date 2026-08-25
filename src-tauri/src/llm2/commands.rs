use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use super::agent::{prompt_agent, OllamaMessage};
use super::pending::{PendingRequests, ToolResultResponse};
use super::skills::{get_cached_skills, reload_skills, setup_skills, write_skill_file, Skill};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaModelInfo {
    pub name: String,
    pub size: Option<u64>,
    pub parameter_size: Option<String>,
    pub quantization_level: Option<String>,
}

#[tauri::command]
pub async fn llm2_send_message(
    prompt: String,
    model: Option<String>,
    message_id: Option<String>,
    history: Option<Vec<OllamaMessage>>,
    num_ctx: Option<usize>,
    system_prompt_addendum: Option<String>,
    allowed_tools: Option<Vec<String>>,
    state: State<'_, PendingRequests>,
    app: AppHandle,
) -> Result<String, String> {
    let pending = (*state).clone();
    prompt_agent(
        app,
        pending,
        &prompt,
        model,
        message_id,
        history,
        num_ctx,
        system_prompt_addendum,
        allowed_tools,
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
pub async fn llm2_list_models() -> Result<Vec<OllamaModelInfo>, String> {
    let client = reqwest::Client::new();
    let res = client
        .get("http://localhost:11434/api/tags")
        .send()
        .await
        .map_err(|e| format!("Cannot connect to Ollama (http://localhost:11434): {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Ollama returned HTTP {}", res.status()));
    }

    let val: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let mut models = Vec::new();
    if let Some(arr) = val.get("models").and_then(|m| m.as_array()) {
        for item in arr {
            if let Some(name) = item.get("name").and_then(|n| n.as_str()) {
                let size = item.get("size").and_then(|s| s.as_u64());
                let parameter_size = item
                    .get("details")
                    .and_then(|d| d.get("parameter_size"))
                    .and_then(|p| p.as_str())
                    .map(|s| s.to_string());
                let quantization_level = item
                    .get("details")
                    .and_then(|d| d.get("quantization_level"))
                    .and_then(|q| q.as_str())
                    .map(|s| s.to_string());
                models.push(OllamaModelInfo {
                    name: name.to_string(),
                    size,
                    parameter_size,
                    quantization_level,
                });
            }
        }
    }
    Ok(models)
}

#[tauri::command]
pub async fn llm2_skill_setup(workspace_root: String, app: AppHandle) -> Result<Vec<Skill>, String> {
    setup_skills(&workspace_root, &app)
}

#[tauri::command]
pub async fn llm2_skill_reload(workspace_root: String, app: AppHandle) -> Result<Vec<Skill>, String> {
    reload_skills(&workspace_root, &app)
}

#[tauri::command]
pub async fn llm2_skill_list(workspace_root: String, app: AppHandle) -> Result<Vec<Skill>, String> {
    get_cached_skills(&workspace_root, &app)
}

#[tauri::command]
pub async fn llm2_write_skill(
    workspace_root: String,
    name: String,
    content: String,
    app: AppHandle,
) -> Result<Skill, String> {
    write_skill_file(&workspace_root, &name, &content, &app)
}


