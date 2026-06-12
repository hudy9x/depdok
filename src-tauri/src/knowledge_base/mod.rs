use std::sync::Mutex;
use tauri::Manager;

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

    let embedder = embedding::init_embedder(cache_dir)?;
    let dims = embedder.dimensions();

    let conn = db::init_database(app_handle, dims)?;
    
    let kb_manager = manager::KbManager::new(conn, embedder);
    let shared_embedder = kb_manager.embedder_lock();

    Ok((
        KbState(kb_manager),
        embedding::EmbedderState(shared_embedder),
    ))
}
