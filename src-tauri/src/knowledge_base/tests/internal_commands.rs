use rusqlite::Connection;

use crate::knowledge_base::{
    embedding::Embedder,
    manager::KbManager,
};

struct MockEmbedder;

#[async_trait::async_trait]
impl Embedder for MockEmbedder {
    async fn embed(&self, _text: &str) -> Result<Vec<f32>, String> {
        Ok(vec![0.1, 0.2, 0.3, 0.4])
    }

    fn dimensions(&self) -> usize {
        4
    }

    fn name(&self) -> &'static str {
        "mock/embedder"
    }
}

async fn build_test_manager() -> Result<KbManager, String> {
    unsafe {
        rusqlite::ffi::sqlite3_auto_extension(Some(std::mem::transmute(
            sqlite_vec::sqlite3_vec_init as *const (),
        )));
    }
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

        CREATE TABLE document_chunks (
            chunk_id    TEXT PRIMARY KEY,
            document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            chunk_index INTEGER NOT NULL,
            content     TEXT NOT NULL
        );

        CREATE TABLE document_tags (
            document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            tag         TEXT NOT NULL,
            PRIMARY KEY (document_id, tag)
        );

        -- In tests, we size the embedding dimension to 4 to match MockEmbedder
        CREATE VIRTUAL TABLE documents_embeddings USING vec0(
            chunk_id    TEXT PRIMARY KEY,
            document_id TEXT,
            embedding   FLOAT[4]
        );
        
        -- Create documents_fts table and triggers
        CREATE VIRTUAL TABLE documents_fts USING fts5(
            title,
            content,
            content=documents,
            content_rowid=rowid
        );

        CREATE TRIGGER documents_fts_insert AFTER INSERT ON documents BEGIN
            INSERT INTO documents_fts (rowid, title, content)
            VALUES (new.rowid, new.title, new.content);
        END;

        CREATE TRIGGER documents_fts_update AFTER UPDATE ON documents BEGIN
            INSERT INTO documents_fts (documents_fts, rowid, title, content)
            VALUES ('delete', old.rowid, old.title, old.content);
            INSERT INTO documents_fts (rowid, title, content)
            VALUES (new.rowid, new.title, new.content);
        END;

        CREATE TRIGGER documents_fts_delete AFTER DELETE ON documents BEGIN
            INSERT INTO documents_fts (documents_fts, rowid, title, content)
            VALUES ('delete', old.rowid, old.title, old.content);
        END;
        ",
    )
    .map_err(|e| e.to_string())?;

    Ok(KbManager::new(conn, Box::new(MockEmbedder)))
}

#[tokio::test]
async fn upsert_and_get_document_works() -> Result<(), String> {
    let kb = build_test_manager().await?;

    let doc_id = kb.upsert_document(
        Some("doc-1".to_string()),
        "My title".to_string(),
        "My content #tag-one with some text.".to_string(),
        vec!["project-a".to_string()],
    ).await?;

    assert_eq!(doc_id, "doc-1");

    let found = kb.get_document("doc-1".to_string()).await?;
    let found = found.ok_or_else(|| "Expected document to exist".to_string())?;
    assert_eq!(found.id, "doc-1");
    assert_eq!(found.title, "My title");
    assert_eq!(found.content, "My content #tag-one with some text.");

    // Check chunks and tags were populated
    let conn = kb.db_lock();
    let conn = conn.lock().await;
    
    let chunk_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM document_chunks WHERE document_id = 'doc-1'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    assert_eq!(chunk_count, 1);

    let tag_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM document_tags WHERE document_id = 'doc-1'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    assert_eq!(tag_count, 1);

    Ok(())
}

#[tokio::test]
async fn get_chunk_context_works() -> Result<(), String> {
    let kb = build_test_manager().await?;

    // Create a document with long content that will split into multiple chunks.
    // Chunk size defaults to max_chars: 512, overlap: 64.
    let content = format!(
        "{}\n\n{}\n\n{}",
        "First chunk content that is relatively short. ".repeat(15),
        "Second chunk content that describes another thing. ".repeat(15),
        "Third chunk content concluding the document. ".repeat(15)
    );

    kb.upsert_document(
        Some("doc-context".to_string()),
        "Context Test".to_string(),
        content,
        vec!["project-a".to_string()],
    ).await?;

    // Fetch chunk text from DB to get a chunk containing "Second"
    let chunk_id: String = {
        let conn = kb.db_lock();
        let conn = conn.lock().await;
        conn.query_row(
            "SELECT chunk_id FROM document_chunks WHERE document_id = 'doc-context' AND content LIKE '%Second%' LIMIT 1",
            [],
            |row| row.get(0),
        ).map_err(|e| e.to_string())?
    };

    let context = kb.get_chunk_context(chunk_id, 1).await?;
    assert!(context.len() >= 2);
    assert!(context.iter().any(|c| c.contains("Second")));

    Ok(())
}

#[tokio::test]
async fn hybrid_search_rrf_works() -> Result<(), String> {
    let kb = build_test_manager().await?;

    kb.upsert_document(
        Some("doc-a".to_string()),
        "Rust Ownership".to_string(),
        "Rust uses ownership and borrowing to manage memory safety without a garbage collector.".to_string(),
        vec!["group-1".to_string()],
    ).await?;

    kb.upsert_document(
        Some("doc-b".to_string()),
        "Garbage Collection".to_string(),
        "Many languages like Go and Java use garbage collection to automatically reclaim memory.".to_string(),
        vec!["group-1".to_string()],
    ).await?;

    let results = kb.search_hybrid("ownership".to_string(), 10).await?;
    assert!(!results.is_empty());
    // Rust Ownership should be the top match because "ownership" is in its title and content.
    assert_eq!(results[0].document_id, "doc-a");
    assert!(results[0].matched_chunks.len() >= 1);

    Ok(())
}

#[tokio::test]
async fn connect_and_delete_document_works() -> Result<(), String> {
    let kb = build_test_manager().await?;

    kb.upsert_document(
        Some("doc-a".to_string()),
        "A".to_string(),
        "Alpha".to_string(),
        vec!["project-a".to_string()],
    ).await?;
    kb.upsert_document(
        Some("doc-b".to_string()),
        "B".to_string(),
        "Beta".to_string(),
        vec!["project-a".to_string()],
    ).await?;

    // Create edge via edges table directly
    {
        let conn = kb.db_lock();
        let conn = conn.lock().await;
        conn.execute(
            "INSERT INTO edges (id, source_id, target_id, type) VALUES ('edge-1', 'doc-a', 'doc-b', 'related')",
            [],
        ).map_err(|e| e.to_string())?;
    }

    kb.delete_document("doc-a".to_string()).await?;

    let conn = kb.db_lock();
    let conn = conn.lock().await;
    
    let edges_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM edges", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    assert_eq!(edges_count, 0);

    let chunks_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM document_chunks WHERE document_id = 'doc-a'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    assert_eq!(chunks_count, 0);

    let doc_groups_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM document_groups WHERE document_id = 'doc-a'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    assert_eq!(doc_groups_count, 0);

    Ok(())
}

#[tokio::test]
async fn get_project_graph_returns_group_data() -> Result<(), String> {
    let kb = build_test_manager().await?;

    kb.upsert_document(
        Some("doc-g1".to_string()),
        "Graph One".to_string(),
        "Alpha".to_string(),
        vec!["project-graph".to_string()],
    ).await?;
    kb.upsert_document(
        Some("doc-g2".to_string()),
        "Graph Two".to_string(),
        "Beta".to_string(),
        vec!["project-graph".to_string()],
    ).await?;

    // Connect documents (both exist in DB)
    {
        let conn = kb.db_lock();
        let conn = conn.lock().await;
        conn.execute(
            "INSERT INTO edges (id, source_id, target_id, type) VALUES ('edge-1', 'doc-g1', 'doc-g2', 'related')",
            [],
        ).map_err(|e| e.to_string())?;
    }

    let graph = kb.get_project_graph("project-graph".to_string()).await?;
    assert_eq!(graph.group_id, "project-graph");
    assert_eq!(graph.documents.len(), 2);
    assert_eq!(graph.edges.len(), 1);

    Ok(())
}
