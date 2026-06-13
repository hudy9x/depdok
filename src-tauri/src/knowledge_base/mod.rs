use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_store::StoreExt;

pub mod commands;
pub mod db;
pub mod embedding;
pub mod manager;
pub mod markdown_chunking;
pub mod parser;
#[cfg(test)]
mod tests;

/// Tauri managed state wrapping the shared knowledge base manager.
pub struct KbState(pub manager::KbManager);

/// Current project/group selected by the UI.
pub struct CurrentProjectGroup(pub Mutex<Option<String>>);

/// Initialise both the database and the embedder, returning the two managed
/// states to be registered with `app.manage(...)` inside Tauri's `.setup()`.
pub fn init_knowledge_base(
    app_handle: &tauri::AppHandle,
) -> Result<(KbState, embedding::EmbedderState), String> {
    // Resolve cache directory for the embedding model.
    let cache_dir = app_handle.path().app_cache_dir().ok();

    // Read saved configuration
    let (model_type, model_name, openai_key) = if let Ok(store) = app_handle.store("store.json") {
        let m_type = store.get("embedding_model_type")
            .and_then(|v| v.as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| "local".to_string());
        let m_name = store.get("embedding_model_name")
            .and_then(|v| v.as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| "all-MiniLM-L6-v2".to_string());
        let api_key = store.get("openai_api_key")
            .and_then(|v| v.as_str().map(|s| s.to_string()));
        (m_type, m_name, api_key)
    } else {
        ("local".to_string(), "all-MiniLM-L6-v2".to_string(), None)
    };

    let embedder = embedding::init_embedder_with_config(cache_dir, &model_type, &model_name, openai_key, false)?;
    let dims = embedder.dimensions();

    let conn = db::init_database(app_handle, dims)?;
    
    let kb_manager = manager::KbManager::new(conn, embedder);
    let shared_embedder = kb_manager.embedder_lock();

    Ok((
        KbState(kb_manager),
        embedding::EmbedderState(shared_embedder),
    ))
}
