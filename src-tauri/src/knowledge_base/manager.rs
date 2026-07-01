use std::path::Path;
use std::sync::Arc;
use tokio::sync::RwLock;
use rusqlite::{params, Connection};
use serde::Serialize;

use crate::knowledge_base::embedding::{Embedder, chunker::{chunk_text, ChunkOptions}};
use crate::knowledge_base::parser::{extract_metadata, split_markdown_into_sections};

#[derive(Serialize, Clone, Debug)]
pub struct HybridSearchResult {
    #[serde(rename = "documentId")]
    pub document_id: String,
    pub title: String,
    pub content: String,
    pub score: f32,
    #[serde(rename = "matchedChunks")]
    pub matched_chunks: Vec<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub distance: f32,
}

#[derive(Serialize, Clone, Debug)]
pub struct GraphDocumentRecord {
    pub id: String,
    pub title: String,
    pub content: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct GraphEdgeRecord {
    pub id: String,
    #[serde(rename = "sourceId")]
    pub source_id: String,
    #[serde(rename = "targetId")]
    pub target_id: String,
    #[serde(rename = "edgeType")]
    pub edge_type: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct ProjectGraphRecord {
    #[serde(rename = "groupId")]
    pub group_id: String,
    #[serde(rename = "groupTitle")]
    pub group_title: String,
    pub documents: Vec<GraphDocumentRecord>,
    pub edges: Vec<GraphEdgeRecord>,
}

#[derive(Clone)]
pub struct KbManager {
    db: Arc<tokio::sync::Mutex<Connection>>,
    embedder: Arc<RwLock<Box<dyn Embedder>>>,
}

fn f32_slice_to_bytes(v: &[f32]) -> Vec<u8> {
    v.iter().flat_map(|f| f.to_le_bytes()).collect()
}

fn resolve_link_id(source_id: &str, link: &str) -> String {
    if source_id.starts_with("file:") && !link.starts_with("file:") {
        let source_path_str = source_id.trim_start_matches("file:");
        let source_path = Path::new(source_path_str);
        if let Some(parent) = source_path.parent() {
            let resolved = parent.join(link);
            return format!("file:{}", resolved.to_string_lossy());
        }
    }
    link.to_string()
}

impl KbManager {
    pub fn new(conn: Connection, embedder: Box<dyn Embedder>) -> Self {
        Self {
            db: Arc::new(tokio::sync::Mutex::new(conn)),
            embedder: Arc::new(RwLock::new(embedder)),
        }
    }

    /// Retrieve the SQLite database connection lock.
    pub fn db_lock(&self) -> Arc<tokio::sync::Mutex<Connection>> {
        self.db.clone()
    }

    /// Retrieve the embedder lock.
    pub fn embedder_lock(&self) -> Arc<RwLock<Box<dyn Embedder>>> {
        self.embedder.clone()
    }

    /// Insert or update a document, automatically parsing tags, links, and creating vector embeddings.
    pub async fn upsert_document(
        &self,
        id: Option<String>,
        title: String,
        content: String,
        group_ids: Vec<String>,
    ) -> Result<String, String> {
        let doc_id = id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

        // 1. Extract metadata (links & tags)
        let metadata = extract_metadata(&content);

        // 2. Chunk text
        let opts = ChunkOptions::default();
        let chunks = chunk_text(&content, &opts);

        // 3. Generate embeddings
        let embeddings: Vec<Vec<f32>> = {
            let embedder = self.embedder.read().await;
            let mut results = Vec::new();
            for chunk in &chunks {
                let vec = embedder.embed(chunk).await?;
                results.push(vec);
            }
            results
        };

        // 4. Persist inside transaction
        let mut conn = self.db.lock().await;
        let tx = conn
            .transaction()
            .map_err(|e| format!("Failed to start transaction: {e}"))?;

        tx.execute(
            "INSERT INTO documents (id, title, content)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(id) DO UPDATE SET
                 title = excluded.title,
                 content = excluded.content",
            params![doc_id, title, content],
        )
        .map_err(|e| format!("Failed to upsert document: {e}"))?;

        // Handle groups
        for group_id in &group_ids {
            if group_id.trim().is_empty() {
                continue;
            }
            let group_title = Path::new(group_id)
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or(group_id)
                .to_string();

            tx.execute(
                "INSERT OR IGNORE INTO groups (id, title) VALUES (?1, ?2)",
                params![group_id, group_title],
            )
            .map_err(|e| format!("Failed to ensure group: {e}"))?;

            tx.execute(
                "INSERT OR IGNORE INTO document_groups (document_id, group_id) VALUES (?1, ?2)",
                params![doc_id, group_id],
            )
            .map_err(|e| format!("Failed to attach document to group: {e}"))?;
        }

        // Clean stale chunks, embeddings, and tags
        tx.execute(
            "DELETE FROM document_chunks WHERE document_id = ?1",
            params![doc_id],
        )
        .map_err(|e| format!("Failed to delete old chunks: {e}"))?;

        tx.execute(
            "DELETE FROM documents_embeddings WHERE document_id = ?1",
            params![doc_id],
        )
        .map_err(|e| format!("Failed to delete old embeddings: {e}"))?;

        tx.execute(
            "DELETE FROM document_tags WHERE document_id = ?1",
            params![doc_id],
        )
        .map_err(|e| format!("Failed to delete old tags: {e}"))?;

        // Insert new chunks and embeddings
        for (i, (chunk_content, embedding)) in chunks.iter().zip(embeddings.iter()).enumerate() {
            let chunk_id = format!("{doc_id}#{i}");

            tx.execute(
                "INSERT INTO document_chunks (chunk_id, document_id, chunk_index, content)
                 VALUES (?1, ?2, ?3, ?4)",
                params![chunk_id, doc_id, i as i64, chunk_content],
            )
            .map_err(|e| format!("Failed to insert chunk {i}: {e}"))?;

            let bytes = f32_slice_to_bytes(embedding);
            tx.execute(
                "INSERT INTO documents_embeddings (chunk_id, document_id, embedding)
                 VALUES (?1, ?2, ?3)",
                params![chunk_id, doc_id, bytes],
            )
            .map_err(|e| format!("Failed to insert embedding chunk {i}: {e}"))?;
        }

        // Insert tags
        for tag in &metadata.tags {
            tx.execute(
                "INSERT OR IGNORE INTO document_tags (document_id, tag) VALUES (?1, ?2)",
                params![doc_id, tag],
            )
            .map_err(|e| format!("Failed to insert tag: {e}"))?;
        }

        // Auto-linking wikilinks
        tx.execute(
            "DELETE FROM edges WHERE source_id = ?1 AND type = 'wikilink'",
            params![doc_id],
        )
        .map_err(|e| format!("Failed to delete old auto-edges: {e}"))?;

        for link in &metadata.links {
            let resolved_target = resolve_link_id(&doc_id, link);
            
            let filename = Path::new(link)
                .file_name()
                .and_then(|f| f.to_str())
                .unwrap_or(link);
            let filename_with_md = if filename.ends_with(".md") {
                filename.to_string()
            } else {
                format!("{}.md", filename)
            };

            let like_section = format!("{}#section:%", resolved_target);
            let like_filename = format!("%/{}", filename_with_md);
            let like_filename_section = format!("%/{}#section:%", filename_with_md);

            let actual_target: Option<String> = tx
                .query_row(
                    "SELECT id FROM documents 
                     WHERE id = ?1 
                        OR id LIKE ?2 
                        OR id LIKE ?3 
                        OR id LIKE ?4 
                     LIMIT 1",
                    params![resolved_target, like_section, like_filename, like_filename_section],
                    |row| row.get(0),
                )
                .ok();

            if let Some(target_id) = actual_target {
                let edge_id = uuid::Uuid::new_v4().to_string();
                tx.execute(
                    "INSERT OR IGNORE INTO edges (id, source_id, target_id, type)
                     VALUES (?1, ?2, ?3, 'wikilink')",
                    params![edge_id, doc_id, target_id],
                )
                .map_err(|e| format!("Failed to insert edge: {e}"))?;
            }
        }

        tx.commit()
            .map_err(|e| format!("Failed to commit transaction: {e}"))?;

        Ok(doc_id)
    }

    /// Split document into sections and index each section separately.
    pub async fn index_markdown_document_sections(
        &self,
        file_path: String,
        document_title: String,
        content: String,
        group_ids: Vec<String>,
    ) -> Result<usize, String> {
        let base_document_id = format!("file:{file_path}");
        let section_id_like = format!("{base_document_id}#section:%");

        // Collect existing documents that were created from this markdown file
        let existing_ids: Vec<String> = {
            let conn = self.db.lock().await;
            let mut stmt = conn
                .prepare("SELECT id FROM documents WHERE id = ?1 OR id LIKE ?2")
                .map_err(|e| e.to_string())?;

            let rows = stmt
                .query_map(params![base_document_id, section_id_like], |row| {
                    row.get(0)
                })
                .map_err(|e| e.to_string())?;

            rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
        };

        for id in existing_ids {
            self.delete_document(id).await?;
        }

        let sections = split_markdown_into_sections(&content);
        if sections.is_empty() {
            self.upsert_document(
                Some(base_document_id),
                document_title,
                content,
                group_ids,
            )
            .await?;
            return Ok(1);
        }

        let mut indexed_count = 0;
        for section in sections {
            let section_document_id = format!("{base_document_id}#section:{}", section.id);
            let section_title = format!("{document_title} - {}", section.title);

            self.upsert_document(
                Some(section_document_id),
                section_title,
                section.content,
                group_ids.clone(),
            )
            .await?;

            indexed_count += 1;
        }

        Ok(indexed_count)
    }

    /// Delete a document (and any of its section documents) and its associated chunks and embeddings.
    pub async fn delete_document(&self, id: String) -> Result<(), String> {
        let mut conn = self.db.lock().await;
        let tx = conn
            .transaction()
            .map_err(|e| format!("Failed to start delete transaction: {e}"))?;

        let section_id_like = format!("{}#section:%", id);

        // sqlite-vec's vec0 doesn't support FK cascading, so we delete embeddings manually
        tx.execute(
            "DELETE FROM documents_embeddings WHERE document_id = ?1 OR document_id LIKE ?2",
            params![id, section_id_like],
        )
        .map_err(|e| format!("Failed to delete embeddings: {e}"))?;

        // Rest of tables will cascade properly from documents table (edges, chunks, tags, group links)
        tx.execute("DELETE FROM documents WHERE id = ?1 OR id LIKE ?2", params![id, section_id_like])
            .map_err(|e| format!("Failed to delete document: {e}"))?;

        tx.commit()
            .map_err(|e| format!("Failed to commit delete transaction: {e}"))?;

        Ok(())
    }

    /// Fetch a single document's metadata and content.
    pub async fn get_document(&self, id: String) -> Result<Option<GraphDocumentRecord>, String> {
        let conn = self.db.lock().await;
        let mut stmt = conn
            .prepare("SELECT id, title, content FROM documents WHERE id = ?1")
            .map_err(|e| e.to_string())?;

        let mut rows = stmt
            .query_map(params![id], |row| {
                Ok(GraphDocumentRecord {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    content: row.get(2)?,
                })
            })
            .map_err(|e| e.to_string())?;

        match rows.next() {
            Some(Ok(record)) => Ok(Some(record)),
            Some(Err(e)) => Err(e.to_string()),
            None => Ok(None),
        }
    }

    /// Fetch a target chunk's text and $N$ preceding/succeeding siblings.
    pub async fn get_chunk_context(&self, chunk_id: String, window: usize) -> Result<Vec<String>, String> {
        let conn = self.db.lock().await;

        let (document_id, chunk_index): (String, i64) = conn
            .query_row(
                "SELECT document_id, chunk_index FROM document_chunks WHERE chunk_id = ?1",
                params![chunk_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| format!("Chunk not found: {e}"))?;

        let start_idx = chunk_index.saturating_sub(window as i64);
        let end_idx = chunk_index + window as i64;

        let mut stmt = conn
            .prepare(
                "SELECT content FROM document_chunks 
                 WHERE document_id = ?1 AND chunk_index BETWEEN ?2 AND ?3
                 ORDER BY chunk_index ASC",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![document_id, start_idx, end_idx], |row| {
                row.get(0)
            })
            .map_err(|e| e.to_string())?;

        let mut chunks = Vec::new();
        for row in rows {
            chunks.push(row.map_err(|e| e.to_string())?);
        }

        Ok(chunks)
    }

    /// Find documents semantically similar to `query` using KNN search on the `vec0` table.
    pub async fn search_similar(
        &self,
        query: String,
        limit: usize,
    ) -> Result<Vec<SearchResult>, String> {
        let query_vector = {
            let embedder = self.embedder.read().await;
            embedder.embed(&query).await?
        };
        let query_bytes = f32_slice_to_bytes(&query_vector);
        let conn = self.db.lock().await;

        let mut stmt = conn
            .prepare(
                "SELECT de.document_id, d.title, de.distance
                 FROM documents_embeddings de
                 LEFT JOIN documents d ON d.id = de.document_id
                 WHERE de.embedding MATCH ?1 AND k = ?2
                 ORDER BY de.distance ASC",
            )
            .map_err(|e| format!("Failed to prepare search query: {e}"))?;

        let rows = stmt
            .query_map(params![query_bytes, limit as i64], |row| {
                Ok(SearchResult {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    distance: row.get(2)?,
                })
            })
            .map_err(|e| format!("Search query failed: {e}"))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| e.to_string())?);
        }

        Ok(results)
    }

    /// Execute a hybrid query combining FTS5 keyword scoring with sqlite-vec KNN search via Reciprocal Rank Fusion (RRF).
    pub async fn search_hybrid(&self, query: String, limit: usize) -> Result<Vec<HybridSearchResult>, String> {
        let limit_i64 = limit as i64;
        let conn = self.db.lock().await;

        // 1. Keyword search (FTS5)
        let clean_query = query.replace('"', "").replace('\'', "");
        let fts_query = if clean_query.trim().is_empty() {
            "".to_string()
        } else {
            let parts: Vec<&str> = clean_query.split_whitespace().collect();
            parts.join(" OR ")
        };

        struct RawResult {
            id: String,
            title: String,
            content: String,
            fts_rank: Option<usize>,
            vec_rank: Option<usize>,
            matched_chunks: Vec<String>,
        }

        let mut doc_map: std::collections::HashMap<String, RawResult> = std::collections::HashMap::new();

        if !fts_query.trim().is_empty() {
            let mut fts_stmt = conn
                .prepare(
                    "SELECT d.id, d.title, d.content, f.rank
                     FROM documents_fts f
                     INNER JOIN documents d ON d.rowid = f.rowid
                     WHERE documents_fts MATCH ?1
                     ORDER BY f.rank ASC LIMIT ?2",
                )
                .map_err(|e| format!("FTS query prepare failed: {e}"))?;

            let mut rows = fts_stmt.query(params![fts_query, limit_i64])
                .map_err(|e| format!("FTS query execution failed: {e}"))?;
            let mut idx = 0;
            while let Some(row) = rows.next().map_err(|e| e.to_string())? {
                let id: String = row.get(0).map_err(|e| e.to_string())?;
                let title: String = row.get(1).map_err(|e| e.to_string())?;
                let content: String = row.get(2).map_err(|e| e.to_string())?;
                
                doc_map.insert(
                    id.clone(),
                    RawResult {
                        id,
                        title,
                        content,
                        fts_rank: Some(idx + 1),
                        vec_rank: None,
                        matched_chunks: Vec::new(),
                    },
                );
                idx += 1;
            }
        }

        // 2. Vector search (KNN)
        let query_vector = {
            let embedder = self.embedder.read().await;
            embedder.embed(&query).await?
        };
        let query_bytes = f32_slice_to_bytes(&query_vector);

        let mut vec_stmt = conn
            .prepare(
                "SELECT de.document_id, d.title, d.content, de.distance, dc.content
                 FROM documents_embeddings de
                 INNER JOIN documents d ON d.id = de.document_id
                 INNER JOIN document_chunks dc ON dc.chunk_id = de.chunk_id
                 WHERE de.embedding MATCH ?1 AND k = ?2
                 ORDER BY de.distance ASC",
            )
            .map_err(|e| format!("Vector query prepare failed: {e}"))?;

        let mut rows = vec_stmt.query(params![query_bytes, limit_i64])
            .map_err(|e| format!("Vector query execution failed: {e}"))?;
        let mut seen_docs = std::collections::HashSet::new();
        let mut vec_counter = 0;

        while let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let id: String = row.get(0).map_err(|e| e.to_string())?;
            let title: String = row.get(1).map_err(|e| e.to_string())?;
            let content: String = row.get(2).map_err(|e| e.to_string())?;
            let _distance: f32 = row.get(3).map_err(|e| e.to_string())?;
            let chunk_content: String = row.get(4).map_err(|e| e.to_string())?;

            let is_new = seen_docs.insert(id.clone());
            if is_new {
                vec_counter += 1;
            }

            let entry = doc_map.entry(id.clone()).or_insert_with(|| RawResult {
                id: id.clone(),
                title,
                content,
                fts_rank: None,
                vec_rank: None,
                matched_chunks: Vec::new(),
            });

            if is_new {
                entry.vec_rank = Some(vec_counter);
            }
            entry.matched_chunks.push(chunk_content);
        }

        // 3. Compute Reciprocal Rank Fusion (RRF)
        let mut scored_results = Vec::new();
        let rrf_k = 60.0f32;

        for (_, doc) in doc_map {
            let fts_term = match doc.fts_rank {
                Some(r) => 1.0 / (rrf_k + r as f32),
                None => 0.0,
            };
            let vec_term = match doc.vec_rank {
                Some(r) => 1.0 / (rrf_k + r as f32),
                None => 0.0,
            };
            let score = fts_term + vec_term;

            scored_results.push(HybridSearchResult {
                document_id: doc.id,
                title: doc.title,
                content: doc.content,
                score,
                matched_chunks: doc.matched_chunks,
            });
        }

        // Sort by RRF score descending
        scored_results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        scored_results.truncate(limit);

        Ok(scored_results)
    }

    /// Retrieve the documents and edges associated with a project group.
    pub async fn get_project_graph(&self, group_id: String) -> Result<ProjectGraphRecord, String> {
        let conn = self.db.lock().await;

        let group_title = Path::new(&group_id)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or(&group_id)
            .to_string();

        conn.execute(
            "INSERT OR IGNORE INTO groups (id, title) VALUES (?1, ?2)",
            params![group_id, group_title],
        )
        .map_err(|e| format!("Failed to ensure group: {e}"))?;

        let group_title: String = conn
            .query_row(
                "SELECT title FROM groups WHERE id = ?1",
                params![group_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        let mut doc_stmt = conn
            .prepare(
                "SELECT d.id, d.title, d.content
                 FROM documents d
                 INNER JOIN document_groups dg ON dg.document_id = d.id
                 WHERE dg.group_id = ?1
                 ORDER BY d.title COLLATE NOCASE",
            )
            .map_err(|e| e.to_string())?;

        let documents = doc_stmt
            .query_map(params![group_id], |row| {
                Ok(GraphDocumentRecord {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    content: row.get(2)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        let mut edge_stmt = conn
            .prepare(
                "SELECT e.id, e.source_id, e.target_id, e.type
                 FROM edges e
                 INNER JOIN document_groups sg ON sg.document_id = e.source_id AND sg.group_id = ?1
                 INNER JOIN document_groups tg ON tg.document_id = e.target_id AND tg.group_id = ?1
                 ORDER BY e.id",
            )
            .map_err(|e| e.to_string())?;

        let edges = edge_stmt
            .query_map(params![group_id], |row| {
                Ok(GraphEdgeRecord {
                    id: row.get(0)?,
                    source_id: row.get(1)?,
                    target_id: row.get(2)?,
                    edge_type: row.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        Ok(ProjectGraphRecord {
            group_id,
            group_title,
            documents,
            edges,
        })
    }

    /// Re-evaluate all document contents, resolve wikilinks, and reconstruct the graph edges.
    pub async fn rebuild_all_edges(&self) -> Result<(), String> {
        let mut conn = self.db.lock().await;
        let tx = conn
            .transaction()
            .map_err(|e| format!("Failed to start transaction: {e}"))?;

        // 1. Clear all wikilink edges
        tx.execute("DELETE FROM edges WHERE type = 'wikilink'", [])
            .map_err(|e| format!("Failed to clear old wikilinks: {e}"))?;

        // 2. Fetch all documents
        let mut stmt = tx
            .prepare("SELECT id, content FROM documents")
            .map_err(|e| e.to_string())?;

        struct DocInfo {
            id: String,
            content: String,
        }

        let rows = stmt
            .query_map([], |row| {
                Ok(DocInfo {
                    id: row.get(0)?,
                    content: row.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut docs = Vec::new();
        for row in rows {
            docs.push(row.map_err(|e| e.to_string())?);
        }
        drop(stmt);

        // 3. Re-evaluate links and insert edges
        for doc in docs {
            let metadata = extract_metadata(&doc.content);
            for link in &metadata.links {
                let resolved_target = resolve_link_id(&doc.id, link);

                let filename = Path::new(link)
                    .file_name()
                    .and_then(|f| f.to_str())
                    .unwrap_or(link);
                let filename_with_md = if filename.ends_with(".md") {
                    filename.to_string()
                } else {
                    format!("{}.md", filename)
                };

                let like_section = format!("{}#section:%", resolved_target);
                let like_filename = format!("%/{}", filename_with_md);
                let like_filename_section = format!("%/{}#section:%", filename_with_md);

                let actual_target: Option<String> = tx
                    .query_row(
                        "SELECT id FROM documents 
                         WHERE id = ?1 
                            OR id LIKE ?2 
                            OR id LIKE ?3 
                            OR id LIKE ?4 
                         LIMIT 1",
                        params![resolved_target, like_section, like_filename, like_filename_section],
                        |row| row.get(0),
                    )
                    .ok();

                if let Some(target_id) = actual_target {
                    let edge_id = uuid::Uuid::new_v4().to_string();
                    tx.execute(
                        "INSERT OR IGNORE INTO edges (id, source_id, target_id, type)
                         VALUES (?1, ?2, ?3, 'wikilink')",
                        params![edge_id, doc.id, target_id],
                    )
                    .map_err(|e| format!("Failed to insert edge: {e}"))?;
                }
            }
        }

        tx.commit()
            .map_err(|e| format!("Failed to commit transaction: {e}"))?;

        Ok(())
    }
}
