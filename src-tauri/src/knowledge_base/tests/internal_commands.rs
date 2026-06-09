use std::sync::Mutex;

use rusqlite::Connection;

use crate::knowledge_base::{
    commands::{
        connect_to_internal, delete_document_internal, get_document_internal,
        get_project_graph_internal, test_database_query_internal, upsert_document_internal,
    },
    embedding::{Embedder, EmbedderState},
    KbState,
};

struct MockEmbedder;

impl Embedder for MockEmbedder {
    fn embed(&self, _text: &str) -> Result<Vec<f32>, String> {
        Ok(vec![0.1, 0.2, 0.3, 0.4])
    }

    fn dimensions(&self) -> usize {
        4
    }

    fn name(&self) -> &'static str {
        "mock/embedder"
    }
}

fn build_test_states() -> Result<(KbState, EmbedderState), String> {
    let conn = Connection::open_in_memory().map_err(|e| e.to_string())?;

    conn.execute_batch(
        "
        PRAGMA foreign_keys = ON;

        CREATE TABLE documents (
            id      TEXT PRIMARY KEY,
            title   TEXT NOT NULL,
            content TEXT NOT NULL
        );

        CREATE TABLE groups (
            id    TEXT PRIMARY KEY,
            title TEXT NOT NULL
        );

        CREATE TABLE document_groups (
            document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            group_id    TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
            PRIMARY KEY (document_id, group_id)
        );

        CREATE TABLE edges (
            id        TEXT PRIMARY KEY,
            source_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            target_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            type      TEXT
        );

        -- In tests, we use a regular table instead of vec0 to keep tests fast and deterministic.
        CREATE TABLE documents_embeddings (
            chunk_id    TEXT PRIMARY KEY,
            document_id TEXT,
            embedding   BLOB
        );
        ",
    )
    .map_err(|e| e.to_string())?;

    Ok((
        KbState(Mutex::new(conn)),
        EmbedderState(Mutex::new(Box::new(MockEmbedder))),
    ))
}

#[test]
fn upsert_and_get_document_internal_works() -> Result<(), String> {
    let (kb_state, embedder_state) = build_test_states()?;

    let doc_id = upsert_document_internal(
        &kb_state,
        &embedder_state,
        Some("doc-1".to_string()),
        "My title".to_string(),
        "My content".to_string(),
        vec!["project-a".to_string()],
    )?;

    assert_eq!(doc_id, "doc-1");

    let found = get_document_internal(&kb_state, "doc-1".to_string())?;
    let found = found.ok_or_else(|| "Expected document to exist".to_string())?;
    assert_eq!(found.id, "doc-1");
    assert_eq!(found.title, "My title");
    assert_eq!(found.content, "My content");

    let conn = kb_state.0.lock().map_err(|e| e.to_string())?;
    let document_groups_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM document_groups WHERE document_id = 'doc-1'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    assert_eq!(document_groups_count, 1);

    Ok(())
}

#[test]
fn connect_and_delete_document_internal_works() -> Result<(), String> {
    let (kb_state, embedder_state) = build_test_states()?;

    upsert_document_internal(
        &kb_state,
        &embedder_state,
        Some("doc-a".to_string()),
        "A".to_string(),
        "Alpha".to_string(),
        vec!["project-a".to_string()],
    )?;
    upsert_document_internal(
        &kb_state,
        &embedder_state,
        Some("doc-b".to_string()),
        "B".to_string(),
        "Beta".to_string(),
        vec!["project-a".to_string()],
    )?;

    let edge_id = connect_to_internal(
        &kb_state,
        "doc-a".to_string(),
        "doc-b".to_string(),
        Some("related".to_string()),
    )?;
    assert!(!edge_id.is_empty());

    delete_document_internal(&kb_state, "doc-a".to_string())?;

    let conn = kb_state.0.lock().map_err(|e| e.to_string())?;
    let edges_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM edges", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    assert_eq!(edges_count, 0);

    let embeddings_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM documents_embeddings WHERE document_id = 'doc-a'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    assert_eq!(embeddings_count, 0);

    let document_groups_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM document_groups WHERE document_id = 'doc-a'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    assert_eq!(document_groups_count, 0);

    Ok(())
}

#[test]
fn test_database_query_internal_returns_counts() -> Result<(), String> {
    let (kb_state, embedder_state) = build_test_states()?;

    upsert_document_internal(
        &kb_state,
        &embedder_state,
        Some("doc-z".to_string()),
        "Z".to_string(),
        "Zed".to_string(),
        vec!["project-z".to_string()],
    )?;

    let result = test_database_query_internal(&kb_state)?;
    assert!(!result.sqlite_version.is_empty());
    assert!(result.documents_count >= 1);
    assert!(result.embeddings_count >= 1);

    Ok(())
}

#[test]
fn get_project_graph_internal_returns_group_data() -> Result<(), String> {
    let (kb_state, embedder_state) = build_test_states()?
;

    upsert_document_internal(
        &kb_state,
        &embedder_state,
        Some("doc-g1".to_string()),
        "Graph One".to_string(),
        "Alpha".to_string(),
        vec!["project-graph".to_string()],
    )?;
    upsert_document_internal(
        &kb_state,
        &embedder_state,
        Some("doc-g2".to_string()),
        "Graph Two".to_string(),
        "Beta".to_string(),
        vec!["project-graph".to_string()],
    )?;

    connect_to_internal(
        &kb_state,
        "doc-g1".to_string(),
        "doc-g2".to_string(),
        Some("related".to_string()),
    )?;

    let graph = get_project_graph_internal(&kb_state, "project-graph".to_string())?;
    assert_eq!(graph.group_id, "project-graph");
    assert_eq!(graph.documents.len(), 2);
    assert_eq!(graph.edges.len(), 1);

    Ok(())
}
