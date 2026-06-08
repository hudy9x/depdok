use rusqlite::params;
use serde::Serialize;
use tauri::State;
use uuid::Uuid;

use super::{
    embedding::{
        chunker::{chunk_text, ChunkOptions},
        EmbedderState,
    },
    KbState,
};

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub distance: f32,
}

#[derive(Serialize)]
pub struct DocumentRecord {
    pub id: String,
    pub title: String,
    pub content: String,
}

#[derive(Serialize)]
pub struct DatabaseTestResult {
    pub sqlite_version: String,
    pub db_path: String,
    pub documents_count: i64,
    pub edges_count: i64,
    pub embeddings_count: i64,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Serialise a `&[f32]` to a raw little-endian byte buffer suitable for
/// storing in / querying against a `sqlite-vec` `vec0` column.
fn f32_slice_to_bytes(v: &[f32]) -> Vec<u8> {
    v.iter().flat_map(|f| f.to_le_bytes()).collect()
}

/// Internal reusable implementation for upserting documents + vector chunks.
///
/// This is shared by the public Tauri command and backend hooks (e.g. file
/// create/update debounce pipeline) so behavior stays consistent.
pub fn upsert_document_internal(
    kb_state: &super::KbState,
    embedder_state: &super::embedding::EmbedderState,
    id: Option<String>,
    title: String,
    content: String,
) -> Result<String, String> {
    let doc_id = id.unwrap_or_else(|| Uuid::new_v4().to_string());

    // --- Chunk + embed (CPU-bound; done outside the DB lock) -----------------
    let opts = ChunkOptions::default();
    let chunks = chunk_text(&content, &opts);

    let embeddings: Vec<Vec<f32>> = {
        let embedder = embedder_state
            .0
            .lock()
            .map_err(|e| format!("Embedder lock poisoned: {e}"))?;
        chunks
            .iter()
            .map(|chunk| embedder.embed(chunk))
            .collect::<Result<Vec<_>, _>>()?
    };

    // --- Persist to DB -------------------------------------------------------
    let conn = kb_state
        .0
        .lock()
        .map_err(|e| format!("DB lock poisoned: {e}"))?;

    conn.execute(
        "INSERT OR REPLACE INTO documents (id, title, content) VALUES (?1, ?2, ?3)",
        params![doc_id, title, content],
    )
    .map_err(|e| format!("Failed to upsert document: {e}"))?;

    // Remove stale vector chunks for this document (vec0 has no FK cascade).
    conn.execute(
        "DELETE FROM documents_embeddings WHERE document_id = ?1",
        params![doc_id],
    )
    .map_err(|e| format!("Failed to delete old embeddings: {e}"))?;

    // Insert fresh chunks.
    for (i, embedding) in embeddings.iter().enumerate() {
        let chunk_id = format!("{doc_id}#{i}");
        let bytes = f32_slice_to_bytes(embedding);
        conn.execute(
            "INSERT INTO documents_embeddings (chunk_id, document_id, embedding) VALUES (?1, ?2, ?3)",
            params![chunk_id, doc_id, bytes],
        )
        .map_err(|e| format!("Failed to insert embedding chunk {i}: {e}"))?;
    }

    Ok(doc_id)
}

pub fn delete_document_internal(
    kb_state: &super::KbState,
    id: String,
) -> Result<(), String> {
    let conn = kb_state
        .0
        .lock()
        .map_err(|e| format!("DB lock poisoned: {e}"))?;

    // vec0 does not honour FK constraints — delete chunks manually first.
    conn.execute(
        "DELETE FROM documents_embeddings WHERE document_id = ?1",
        params![id],
    )
    .map_err(|e| format!("Failed to delete embeddings: {e}"))?;

    // Deleting the document cascades to `edges` via FK.
    conn.execute("DELETE FROM documents WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete document: {e}"))?;

    Ok(())
}

pub fn connect_to_internal(
    kb_state: &super::KbState,
    source_id: String,
    target_id: String,
    edge_type: Option<String>,
) -> Result<String, String> {
    let edge_id = Uuid::new_v4().to_string();
    let conn = kb_state
        .0
        .lock()
        .map_err(|e| format!("DB lock poisoned: {e}"))?;

    conn.execute(
        "INSERT INTO edges (id, source_id, target_id, type) VALUES (?1, ?2, ?3, ?4)",
        params![edge_id, source_id, target_id, edge_type],
    )
    .map_err(|e| format!("Failed to insert edge: {e}"))?;

    Ok(edge_id)
}

pub fn search_similar_internal(
    kb_state: &super::KbState,
    embedder_state: &super::embedding::EmbedderState,
    query: String,
    limit: usize,
) -> Result<Vec<SearchResult>, String> {
    let query_vec: Vec<f32> = {
        let embedder = embedder_state
            .0
            .lock()
            .map_err(|e| format!("Embedder lock poisoned: {e}"))?;
        embedder.embed(&query)?
    };
    let query_bytes = f32_slice_to_bytes(&query_vec);

    let conn = kb_state
        .0
        .lock()
        .map_err(|e| format!("DB lock poisoned: {e}"))?;

    let mut stmt = conn
        .prepare(
            "SELECT de.document_id, d.title, de.distance
             FROM documents_embeddings de
             LEFT JOIN documents d ON d.id = de.document_id
             WHERE de.embedding MATCH ?1
             ORDER BY de.distance
             LIMIT ?2",
        )
        .map_err(|e| format!("Failed to prepare search query: {e}"))?;

    let results = stmt
        .query_map(params![query_bytes, limit as i64], |row| {
            Ok(SearchResult {
                id: row.get(0)?,
                title: row.get(1)?,
                distance: row.get(2)?,
            })
        })
        .map_err(|e| format!("Search query failed: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect search results: {e}"))?;

    Ok(results)
}

pub fn get_document_internal(
    kb_state: &super::KbState,
    id: String,
) -> Result<Option<DocumentRecord>, String> {
    let conn = kb_state
        .0
        .lock()
        .map_err(|e| format!("DB lock poisoned: {e}"))?;

    let mut stmt = conn
        .prepare("SELECT id, title, content FROM documents WHERE id = ?1")
        .map_err(|e| format!("Failed to prepare get_document query: {e}"))?;

    let mut rows = stmt
        .query_map(params![id], |row| {
            Ok(DocumentRecord {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
            })
        })
        .map_err(|e| format!("get_document query failed: {e}"))?;

    match rows.next() {
        Some(Ok(record)) => Ok(Some(record)),
        Some(Err(e)) => Err(e.to_string()),
        None => Ok(None),
    }
}

pub fn test_database_query_internal(
    kb_state: &super::KbState,
) -> Result<DatabaseTestResult, String> {
    let conn = kb_state
        .0
        .lock()
        .map_err(|e| format!("DB lock poisoned: {e}"))?;

    let sqlite_version: String = conn
        .query_row("SELECT sqlite_version()", [], |row| row.get(0))
        .map_err(|e| format!("Failed to read sqlite version: {e}"))?;

    let db_path: String = conn
        .query_row(
            "SELECT file FROM pragma_database_list WHERE name = 'main'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to resolve database path: {e}"))?;

    let documents_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM documents", [], |row| row.get(0))
        .map_err(|e| format!("Failed to count documents: {e}"))?;

    let edges_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM edges", [], |row| row.get(0))
        .map_err(|e| format!("Failed to count edges: {e}"))?;

    let embeddings_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM documents_embeddings", [], |row| row.get(0))
        .map_err(|e| format!("Failed to count embeddings: {e}"))?;

    Ok(DatabaseTestResult {
        sqlite_version,
        db_path,
        documents_count,
        edges_count,
        embeddings_count,
    })
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Insert or replace a document and regenerate all of its vector chunks.
///
/// If `id` is `None` a new UUID v4 is generated. Returns the document id.
#[tauri::command]
pub async fn insert_or_replace_document(
    kb_state: State<'_, KbState>,
    embedder_state: State<'_, EmbedderState>,
    id: Option<String>,
    title: String,
    content: String,
) -> Result<String, String> {
    upsert_document_internal(&kb_state, &embedder_state, id, title, content)
}

/// Delete a document and all associated edges and vector chunks.
#[tauri::command]
pub async fn delete_document(
    kb_state: State<'_, KbState>,
    id: String,
) -> Result<(), String> {
    delete_document_internal(&kb_state, id)
}

/// Add a directed edge between two documents in the knowledge graph.
/// Returns the new edge id.
#[tauri::command]
pub async fn connect_to(
    kb_state: State<'_, KbState>,
    source_id: String,
    target_id: String,
    edge_type: Option<String>,
) -> Result<String, String> {
    connect_to_internal(&kb_state, source_id, target_id, edge_type)
}

/// Find documents semantically similar to `query` using KNN search on the
/// `vec0` table. Returns up to `limit` results ordered by ascending distance.
#[tauri::command]
pub async fn search_similar(
    kb_state: State<'_, KbState>,
    embedder_state: State<'_, EmbedderState>,
    query: String,
    limit: usize,
) -> Result<Vec<SearchResult>, String> {
    search_similar_internal(&kb_state, &embedder_state, query, limit)
}

/// Retrieve a single document by id. Returns `None` when not found.
#[tauri::command]
pub async fn get_document(
    kb_state: State<'_, KbState>,
    id: String,
) -> Result<Option<DocumentRecord>, String> {
    get_document_internal(&kb_state, id)
}

#[tauri::command]
pub async fn test_database_query(
    kb_state: State<'_, KbState>,
) -> Result<DatabaseTestResult, String> {
    let result = test_database_query_internal(&kb_state)?;
    println!(
        "[knowledge_base] test_database_query: docs={}, edges={}, embeddings={}",
        result.documents_count, result.edges_count, result.embeddings_count
    );
    Ok(result)
}
