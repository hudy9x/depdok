use rusqlite::Connection;
use tauri::Manager;

/// Initialise the SQLite database for the knowledge base.
///
/// Steps:
/// 1. Resolve the OS app-data directory.
/// 2. Register the `sqlite-vec` extension globally via `sqlite3_auto_extension`
///    so every subsequent `Connection::open` has the `vec0` virtual table available.
/// 3. Open the connection and apply pragmas.
/// 4. Create the schema (idempotent).
///
/// `dims` is read from the active `Embedder::dimensions()` so the `vec0` table
/// is always sized correctly for the current provider.
pub fn init_database(
    app_handle: &tauri::AppHandle,
    dims: usize,
) -> Result<Connection, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;

    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data dir: {e}"))?;

    // Register sqlite-vec before the first Connection::open.
    // SAFETY: sqlite3_auto_extension stores a function pointer in a global SQLite
    // registry; this is the documented way to load SQLite extensions at startup.
    unsafe {
        rusqlite::ffi::sqlite3_auto_extension(Some(std::mem::transmute(
            sqlite_vec::sqlite3_vec_init as *const (),
        )));
    }

    let db_path = app_data_dir.join("knowledge_base.db");
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Enable FK enforcement (not on by default in SQLite).
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| e.to_string())?;

    // --- Plain tables ----------------------------------------------------------
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS documents (
            id      TEXT PRIMARY KEY,   -- UUID v4
            title   TEXT NOT NULL,
            content TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS groups (
            id    TEXT PRIMARY KEY,
            title TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS document_groups (
            document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            group_id    TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
            PRIMARY KEY (document_id, group_id)
        );

        CREATE TABLE IF NOT EXISTS edges (
            id        TEXT PRIMARY KEY,  -- UUID v4
            source_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            target_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            type      TEXT               -- optional label, e.g. \"related\", \"parent\"
        );
        ",
    )
    .map_err(|e| format!("Schema creation failed: {e}"))?;

    // --- vec0 virtual table ----------------------------------------------------
    // Dimension count is interpolated at runtime so it matches the active provider.
    // NOTE: Changing providers between runs requires re-creating this table because
    //       vec0 does not support ALTER TABLE.
    let create_vec = format!(
        "CREATE VIRTUAL TABLE IF NOT EXISTS documents_embeddings USING vec0(
            chunk_id    TEXT PRIMARY KEY,
            document_id TEXT,
            embedding   FLOAT[{dims}]
        );"
    );

    conn.execute_batch(&create_vec)
        .map_err(|e| format!("vec0 table creation failed: {e}"))?;

    Ok(conn)
}
