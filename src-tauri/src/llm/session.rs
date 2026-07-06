use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedMessage {
    pub role: String,
    pub content: String,
    pub timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_input: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_output: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSession {
    pub id: String,
    pub created_at: String,
    pub model: Option<String>,
    pub provider: String,
    pub messages: Vec<PersistedMessage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSessionMeta {
    pub id: String,
    pub created_at: String,
    pub model: Option<String>,
    pub provider: String,
    pub message_count: usize,
    /// First user message preview (truncated)
    pub preview: String,
}

/// Returns the chat storage directory for a given workspace.
fn chat_dir(workspace_root: &str) -> PathBuf {
    PathBuf::from(workspace_root).join(".depdok").join("chat")
}

/// Generate a new unique session ID based on current timestamp + short UUID.
#[allow(dead_code)]
pub fn new_session_id() -> String {
    let now = Utc::now().format("%Y-%m-%dT%H-%M-%S").to_string();
    let short = Uuid::new_v4().to_string()[..8].to_string();
    format!("{}_{}", now, short)
}

/// Save a full chat session to disk.
pub fn save_session(workspace_root: &str, session: &ChatSession) -> Result<(), String> {
    let dir = chat_dir(workspace_root).join(&session.id);
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create session dir: {}", e))?;
    let path = dir.join("history.json");
    let json =
        serde_json::to_string_pretty(session).map_err(|e| format!("Serialize error: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("Failed to write session: {}", e))?;
    Ok(())
}

/// Load a chat session from disk.
pub fn load_session(workspace_root: &str, session_id: &str) -> Result<ChatSession, String> {
    let path = chat_dir(workspace_root)
        .join(session_id)
        .join("history.json");
    let json = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read session file: {}", e))?;
    serde_json::from_str(&json).map_err(|e| format!("Failed to parse session: {}", e))
}

/// List all session metadata from the workspace's chat directory.
pub fn list_sessions(workspace_root: &str) -> Result<Vec<ChatSessionMeta>, String> {
    let dir = chat_dir(workspace_root);
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut metas = Vec::new();
    let entries = fs::read_dir(&dir).map_err(|e| format!("Failed to read chat dir: {}", e))?;

    for entry in entries.flatten() {
        let history_path = entry.path().join("history.json");
        if !history_path.exists() {
            continue;
        }
        let Ok(json) = fs::read_to_string(&history_path) else {
            continue;
        };
        let Ok(session) = serde_json::from_str::<ChatSession>(&json) else {
            continue;
        };

        let preview = session
            .messages
            .iter()
            .find(|m| m.role == "user")
            .map(|m| {
                let s = m.content.trim();
                if s.len() > 80 {
                    format!("{}…", &s[..80])
                } else {
                    s.to_string()
                }
            })
            .unwrap_or_default();

        metas.push(ChatSessionMeta {
            id: session.id,
            created_at: session.created_at,
            model: session.model,
            provider: session.provider,
            message_count: session.messages.len(),
            preview,
        });
    }

    // Sort newest first
    metas.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(metas)
}

/// Delete a session directory.
pub fn delete_session(workspace_root: &str, session_id: &str) -> Result<(), String> {
    let dir = chat_dir(workspace_root).join(session_id);
    if dir.exists() {
        fs::remove_dir_all(&dir)
            .map_err(|e| format!("Failed to delete session: {}", e))?;
    }
    Ok(())
}
