use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::State;
use uuid::Uuid;
use std::path::Path;

use super::{
    embedding::{
        chunker::{chunk_text, ChunkOptions},
        EmbedderState,
    },
    markdown_chunking::split_markdown_into_sections,
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
pub struct GraphDocumentRecord {
    pub id: String,
    pub title: String,
    pub content: String,
}

#[derive(Serialize)]
pub struct GraphEdgeRecord {
    pub id: String,
    #[serde(rename = "sourceId")]
    pub source_id: String,
    #[serde(rename = "targetId")]
    pub target_id: String,
    #[serde(rename = "edgeType")]
    pub edge_type: Option<String>,
}

#[derive(Serialize)]
pub struct ProjectGraphRecord {
    #[serde(rename = "groupId")]
    pub group_id: String,
    #[serde(rename = "groupTitle")]
    pub group_title: String,
    pub documents: Vec<GraphDocumentRecord>,
    pub edges: Vec<GraphEdgeRecord>,
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

fn group_title_from_id(group_id: &str) -> String {
    Path::new(group_id)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(group_id)
        .to_string()
}

fn ensure_group_internal(conn: &Connection, group_id: &str) -> Result<(), String> {
    let group_title = group_title_from_id(group_id);
    conn.execute(
        "INSERT OR IGNORE INTO groups (id, title) VALUES (?1, ?2)",
        params![group_id, group_title],
    )
    .map_err(|e| format!("Failed to ensure group: {e}"))?;
    Ok(())
}

fn attach_document_to_groups_internal(
    conn: &Connection,
    document_id: &str,
    group_ids: &[String],
) -> Result<(), String> {
    for group_id in group_ids {
        if group_id.trim().is_empty() {
            continue;
        }

        ensure_group_internal(conn, group_id)?;
        conn.execute(
            "INSERT OR IGNORE INTO document_groups (document_id, group_id) VALUES (?1, ?2)",
            params![document_id, group_id],
        )
        .map_err(|e| format!("Failed to attach document to group: {e}"))?;
    }

    Ok(())
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
    group_ids: Vec<String>,
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
        "INSERT INTO documents (id, title, content)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             content = excluded.content",
        params![doc_id, title, content],
    )
    .map_err(|e| format!("Failed to upsert document: {e}"))?;

    attach_document_to_groups_internal(&conn, &doc_id, &group_ids)?;

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

    let knn_limit = limit.max(1) as i64;

    let mut stmt = conn
        .prepare(
            "SELECT de.document_id, d.title, de.distance
             FROM documents_embeddings de
             LEFT JOIN documents d ON d.id = de.document_id
             WHERE de.embedding MATCH ?1 AND k = ?2
             ORDER BY de.distance",
        )
        .map_err(|e| format!("Failed to prepare search query: {e}"))?;

    let results = stmt
        .query_map(params![query_bytes, knn_limit], |row| {
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

pub fn index_markdown_document_sections_internal(
    kb_state: &super::KbState,
    embedder_state: &super::embedding::EmbedderState,
    file_path: String,
    document_title: String,
    content: String,
    group_ids: Vec<String>,
) -> Result<usize, String> {
    let base_document_id = format!("file:{file_path}");
    let section_id_like = format!("{base_document_id}#section:%");

    let existing_ids: Vec<String> = {
        let conn = kb_state
            .0
            .lock()
            .map_err(|e| format!("DB lock poisoned: {e}"))?;

        let mut stmt = conn
            .prepare(
                "SELECT id FROM documents
                 WHERE id = ?1 OR id LIKE ?2",
            )
            .map_err(|e| format!("Failed to prepare stale markdown index query: {e}"))?;

        let rows = stmt
            .query_map(params![base_document_id.clone(), section_id_like], |row| row.get(0))
            .map_err(|e| format!("Failed to query stale markdown index rows: {e}"))?;

        let ids = rows
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect stale markdown index rows: {e}"))?;

        ids
    };

    for existing_id in existing_ids {
        delete_document_internal(kb_state, existing_id)?;
    }

    let sections = split_markdown_into_sections(&content);
    if sections.is_empty() {
        upsert_document_internal(
            kb_state,
            embedder_state,
            Some(base_document_id),
            document_title,
            content,
            group_ids,
        )?;
        return Ok(1);
    }

    let mut indexed_count = 0usize;
    let mut section_id_counts: std::collections::HashMap<String, usize> = std::collections::HashMap::new();

    for section in sections {
        let section_slug_count = section_id_counts.entry(section.id.clone()).or_insert(0);
        *section_slug_count += 1;

        let unique_section_id = if *section_slug_count == 1 {
            section.id.clone()
        } else {
            format!("{}-{}", section.id, *section_slug_count)
        };

        let section_document_id = format!("{base_document_id}#section:{unique_section_id}");
        let section_title = format!("{document_title} - {}", section.title);

        upsert_document_internal(
            kb_state,
            embedder_state,
            Some(section_document_id),
            section_title,
            section.content,
            group_ids.clone(),
        )?;

        indexed_count += 1;
    }

    Ok(indexed_count)
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

pub fn get_project_graph_internal(
    kb_state: &super::KbState,
    group_id: String,
) -> Result<ProjectGraphRecord, String> {
    let conn = kb_state
        .0
        .lock()
        .map_err(|e| format!("DB lock poisoned: {e}"))?;

    ensure_group_internal(&conn, &group_id)?;

    let group_title = conn
        .query_row(
            "SELECT title FROM groups WHERE id = ?1",
            params![group_id.clone()],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to load group title: {e}"))?;

    let mut document_stmt = conn
        .prepare(
            "SELECT d.id, d.title, d.content
             FROM documents d
             INNER JOIN document_groups dg ON dg.document_id = d.id
             WHERE dg.group_id = ?1
             ORDER BY d.title COLLATE NOCASE",
        )
        .map_err(|e| format!("Failed to prepare project graph documents query: {e}"))?;

    let documents = document_stmt
        .query_map(params![group_id.clone()], |row| {
            Ok(GraphDocumentRecord {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
            })
        })
        .map_err(|e| format!("Project graph document query failed: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect project graph documents: {e}"))?;

    let mut edge_stmt = conn
        .prepare(
            "SELECT e.id, e.source_id, e.target_id, e.type
             FROM edges e
             INNER JOIN document_groups source_group ON source_group.document_id = e.source_id AND source_group.group_id = ?1
             INNER JOIN document_groups target_group ON target_group.document_id = e.target_id AND target_group.group_id = ?1
             ORDER BY e.id",
        )
        .map_err(|e| format!("Failed to prepare project graph edges query: {e}"))?;

    let edges = edge_stmt
        .query_map(params![group_id.clone()], |row| {
            Ok(GraphEdgeRecord {
                id: row.get(0)?,
                source_id: row.get(1)?,
                target_id: row.get(2)?,
                edge_type: row.get(3)?,
            })
        })
        .map_err(|e| format!("Project graph edge query failed: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect project graph edges: {e}"))?;

    Ok(ProjectGraphRecord {
        group_id,
        group_title,
        documents,
        edges,
    })
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
    group_ids: Vec<String>,
) -> Result<String, String> {
    upsert_document_internal(&kb_state, &embedder_state, id, title, content, group_ids)
}

#[tauri::command]
pub async fn index_markdown_document_sections(
    kb_state: State<'_, KbState>,
    embedder_state: State<'_, EmbedderState>,
    file_path: String,
    document_title: String,
    content: String,
    group_ids: Vec<String>,
) -> Result<usize, String> {
    index_markdown_document_sections_internal(
        &kb_state,
        &embedder_state,
        file_path,
        document_title,
        content,
        group_ids,
    )
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
pub async fn get_project_graph(
    kb_state: State<'_, KbState>,
    group_id: String,
) -> Result<ProjectGraphRecord, String> {
    get_project_graph_internal(&kb_state, group_id)
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
    let result = test_database_query_internal(&kb_state)?;
    println!(
        "[knowledge_base] test_database_query: docs={}, edges={}, embeddings={}",
        result.documents_count, result.edges_count, result.embeddings_count
    );
    Ok(result)
}
