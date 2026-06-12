use rusqlite::params;
use serde::Serialize;
use tauri::State;

use super::{
    embedding::EmbedderState,
    manager::{GraphDocumentRecord, HybridSearchResult, ProjectGraphRecord, SearchResult},
    KbState,
};

#[derive(Serialize)]
pub struct DatabaseTestResult {
    pub sqlite_version: String,
    pub db_path: String,
    pub documents_count: i64,
    pub edges_count: i64,
    pub embeddings_count: i64,
}

#[tauri::command]
pub async fn insert_or_replace_document(
    kb_state: State<'_, KbState>,
    _embedder_state: State<'_, EmbedderState>,
    id: Option<String>,
    title: String,
    content: String,
    group_ids: Vec<String>,
) -> Result<String, String> {
    kb_state.0.upsert_document(id, title, content, group_ids).await
}

#[tauri::command]
pub async fn index_markdown_document_sections(
    kb_state: State<'_, KbState>,
    _embedder_state: State<'_, EmbedderState>,
    file_path: String,
    document_title: String,
    content: String,
    group_ids: Vec<String>,
) -> Result<usize, String> {
    kb_state.0.index_markdown_document_sections(file_path, document_title, content, group_ids).await
}

#[tauri::command]
pub async fn delete_document(
    kb_state: State<'_, KbState>,
    id: String,
) -> Result<(), String> {
    kb_state.0.delete_document(id).await
}

#[tauri::command]
pub async fn connect_to(
    kb_state: State<'_, KbState>,
    source_id: String,
    target_id: String,
    edge_type: Option<String>,
) -> Result<String, String> {
    let edge_id = uuid::Uuid::new_v4().to_string();
    let conn = kb_state.0.db_lock();
    let conn = conn.lock().await;
    
    // Check if target exists first
    let target_exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM documents WHERE id = ?1)",
        params![target_id],
        |row| row.get(0),
    ).unwrap_or(false);
    
    if !target_exists {
        return Err("Target document does not exist".to_string());
    }

    conn.execute(
        "INSERT INTO edges (id, source_id, target_id, type) VALUES (?1, ?2, ?3, ?4)",
        params![edge_id, source_id, target_id, edge_type],
    )
    .map_err(|e| format!("Failed to insert edge: {e}"))?;

    Ok(edge_id)
}

#[tauri::command]
pub async fn search_similar(
    kb_state: State<'_, KbState>,
    _embedder_state: State<'_, EmbedderState>,
    query: String,
    limit: usize,
) -> Result<Vec<SearchResult>, String> {
    kb_state.0.search_similar(query, limit).await
}

#[tauri::command]
pub async fn search_hybrid(
    kb_state: State<'_, KbState>,
    query: String,
    limit: usize,
) -> Result<Vec<HybridSearchResult>, String> {
    kb_state.0.search_hybrid(query, limit).await
}

#[tauri::command]
pub async fn get_chunk_context(
    kb_state: State<'_, KbState>,
    chunk_id: String,
    window: usize,
) -> Result<Vec<String>, String> {
    kb_state.0.get_chunk_context(chunk_id, window).await
}

#[tauri::command]
pub async fn get_document(
    kb_state: State<'_, KbState>,
    id: String,
) -> Result<Option<GraphDocumentRecord>, String> {
    kb_state.0.get_document(id).await
}

#[tauri::command]
pub async fn get_project_graph(
    kb_state: State<'_, KbState>,
    group_id: String,
) -> Result<ProjectGraphRecord, String> {
    kb_state.0.get_project_graph(group_id).await
}

#[tauri::command]
pub async fn set_current_project_group(
    group_state: State<'_, super::CurrentProjectGroup>,
    group_id: String,
) -> Result<(), String> {
    let mut current_group = group_state
        .0
        .lock()
        .map_err(|e| format!("Project group lock poisoned: {e}"))?;
    *current_group = Some(group_id);
    Ok(())
}

#[tauri::command]
pub async fn test_database_query(
    kb_state: State<'_, KbState>,
) -> Result<DatabaseTestResult, String> {
    let conn = kb_state.0.db_lock();
    let conn = conn.lock().await;

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

    let result = DatabaseTestResult {
        sqlite_version,
        db_path,
        documents_count,
        edges_count,
        embeddings_count,
    };
    
    println!(
        "[knowledge_base] test_database_query: docs={}, edges={}, embeddings={}",
        result.documents_count, result.edges_count, result.embeddings_count
    );
    Ok(result)
}

#[tauri::command]
pub async fn rebuild_all_edges(
    kb_state: State<'_, KbState>,
) -> Result<(), String> {
    kb_state.0.rebuild_all_edges().await
}

