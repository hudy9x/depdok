use std::sync::Mutex;

use rusqlite::Connection;
use tauri::Manager;

pub mod commands;
pub mod db;
pub mod embedding;
#[cfg(test)]
mod tests;

/// Tauri managed state wrapping the shared SQLite connection.
pub struct KbState(pub Mutex<Connection>);

/// Initialise both the database and the embedder, returning the two managed
/// states to be registered with `app.manage(...)` inside Tauri's `.setup()`.
///
/// This function is called once at startup. The embedder may perform a one-time
/// model download (~22 MB for the default fastembed provider) — inform the user
/// via the UI before the first launch completes.
pub fn init_knowledge_base(
    app_handle: &tauri::AppHandle,
) -> Result<(KbState, embedding::EmbedderState), String> {
    // Resolve cache directory for the embedding model.
    let cache_dir = app_handle.path().app_cache_dir().ok();

    // Initialise embedder first so we know the dimension count before creating
    // the vec0 table.
    let embedder = embedding::init_embedder(cache_dir)?;
    let dims = embedder.dimensions();

    let conn = db::init_database(app_handle, dims)?;

    Ok((
        KbState(Mutex::new(conn)),
        embedding::EmbedderState(Mutex::new(embedder)),
    ))
}
