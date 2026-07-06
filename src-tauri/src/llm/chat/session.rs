use crate::llm::session::{self, ChatSession, ChatSessionMeta};

#[tauri::command]
pub fn list_chat_sessions(workspace_root: String) -> Result<Vec<ChatSessionMeta>, String> {
    println!("[llm][command] list_chat_sessions for workspace: {}", workspace_root);
    session::list_sessions(&workspace_root)
}

#[tauri::command]
pub fn load_chat_session(
    workspace_root: String,
    session_id: String,
) -> Result<ChatSession, String> {
    println!("[llm][command] load_chat_session: id={} for workspace: {}", session_id, workspace_root);
    session::load_session(&workspace_root, &session_id)
}

#[tauri::command]
pub fn delete_chat_session(
    workspace_root: String,
    session_id: String,
) -> Result<(), String> {
    println!("[llm][command] delete_chat_session: id={} for workspace: {}", session_id, workspace_root);
    session::delete_session(&workspace_root, &session_id)
}
