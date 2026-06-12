use rusqlite::Connection;
use tauri::Manager;
use std::path::Path;

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
pub fn init_database(app_handle: &tauri::AppHandle, dims: usize) -> Result<Connection, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;

    let db_path = app_data_dir.join("knowledge_base.db");

    init_database_at_path(&db_path, dims)
}

/// Initialise the SQLite database at an explicit filesystem path.
///
/// This is shared by the Tauri app and the standalone MCP binary so both
/// entrypoints use the same schema and sqlite-vec setup.
pub fn init_database_at_path(db_path: &Path, dims: usize) -> Result<Connection, String> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create database directory: {e}"))?;
    }

    // Register sqlite-vec before the first Connection::open.
    // SAFETY: sqlite3_auto_extension stores a function pointer in a global SQLite
    // registry; this is the documented way to load SQLite extensions at startup.
    unsafe {
        let _ = rusqlite::ffi::sqlite3_auto_extension(Some(std::mem::transmute(
            sqlite_vec::sqlite3_vec_init as *const (),
        )));
    }

    // Try opening and initializing the database. If it fails due to corruption,
    // delete the database file and try again from scratch.
    match init_database_inner(db_path, dims) {
        Ok(conn) => Ok(conn),
        Err(err_msg) => {
            if err_msg.contains("malformed") || err_msg.contains("corrupt") {
                eprintln!("Database corrupted ({err_msg}). Re-creating database file...");
                let _ = std::fs::remove_file(db_path);
                let _ = std::fs::remove_file(db_path.with_extension("db-wal"));
                let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
                let _ = std::fs::remove_file(db_path.with_extension("db-journal"));
                
                init_database_inner(db_path, dims)
            } else {
                Err(err_msg)
            }
        }
    }
}

/// Helper that performs the actual database opening, pragmas, version check,
/// clean resets, and schema table creations.
fn init_database_inner(db_path: &Path, dims: usize) -> Result<Connection, String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    // Enable FK enforcement (not on by default in SQLite).
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| e.to_string())?;

    // Check version
    let user_version: i32 = conn
        .query_row("PRAGMA user_version;", [], |row| row.get(0))
        .map_err(|e| format!("Failed to read user_version: {e}"))?;

    let target_version = 2;

    if user_version < target_version {
        // Drop all existing tables to perform a clean reset, avoiding trigger/virtual table mismatches.
        conn.execute_batch(
            "
            PRAGMA foreign_keys = OFF;
            DROP TRIGGER IF EXISTS documents_fts_insert;
            DROP TRIGGER IF EXISTS documents_fts_update;
            DROP TRIGGER IF EXISTS documents_fts_delete;
            DROP TABLE IF EXISTS documents_fts;
            DROP TABLE IF EXISTS documents_embeddings;
            DROP TABLE IF EXISTS document_chunks;
            DROP TABLE IF EXISTS document_tags;
            DROP TABLE IF EXISTS document_groups;
            DROP TABLE IF EXISTS edges;
            DROP TABLE IF EXISTS groups;
            DROP TABLE IF EXISTS documents;
            PRAGMA foreign_keys = ON;
            "
        ).map_err(|e| format!("Failed to clear old database tables: {e}"))?;
    }

    // --- Plain tables ----------------------------------------------------------
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS documents (
            id      TEXT PRIMARY KEY,   -- UUID v4 or file:{path}
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
            type      TEXT               -- E.g. \"related\", \"wikilink\"
        );

        CREATE TABLE IF NOT EXISTS document_chunks (
            chunk_id    TEXT PRIMARY KEY,
            document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            chunk_index INTEGER NOT NULL,
            content     TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS document_tags (
            document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            tag         TEXT NOT NULL,
            PRIMARY KEY (document_id, tag)
        );

        -- Index foreign keys
        CREATE INDEX IF NOT EXISTS idx_chunks_doc ON document_chunks(document_id);
        CREATE INDEX IF NOT EXISTS idx_tags_doc ON document_tags(document_id);
        CREATE INDEX IF NOT EXISTS idx_tags_tag ON document_tags(tag);
        ",
    )
    .map_err(|e| format!("Schema creation failed: {e}"))?;

    // --- FTS5 virtual table & triggers -----------------------------------------
    conn.execute_batch(
        "
        CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
            title,
            content,
            content=documents,
            content_rowid=rowid
        );

        CREATE TRIGGER IF NOT EXISTS documents_fts_insert AFTER INSERT ON documents BEGIN
            INSERT INTO documents_fts (rowid, title, content)
            VALUES (new.rowid, new.title, new.content);
        END;

        CREATE TRIGGER IF NOT EXISTS documents_fts_update AFTER UPDATE ON documents BEGIN
            INSERT INTO documents_fts (documents_fts, rowid, title, content)
            VALUES ('delete', old.rowid, old.title, old.content);
            INSERT INTO documents_fts (rowid, title, content)
            VALUES (new.rowid, new.title, new.content);
        END;

        CREATE TRIGGER IF NOT EXISTS documents_fts_delete AFTER DELETE ON documents BEGIN
            INSERT INTO documents_fts (documents_fts, rowid, title, content)
            VALUES ('delete', old.rowid, old.title, old.content);
        END;
        "
    )
    .map_err(|e| format!("FTS5 table or trigger creation failed: {e}"))?;

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

    if user_version < target_version {
        // Set new user_version
        conn.execute_batch(&format!("PRAGMA user_version = {target_version};"))
            .map_err(|e| format!("Failed to set user_version: {e}"))?;
    }

    Ok(conn)
}
