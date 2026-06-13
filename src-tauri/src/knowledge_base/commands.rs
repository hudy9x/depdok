use rusqlite::params;
use serde::Serialize;
use tauri::{State, Manager};

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

#[derive(serde::Serialize)]
pub struct CurrentModelStatus {
    #[serde(rename = "modelType")]
    pub model_type: String,
    #[serde(rename = "modelName")]
    pub model_name: String,
    #[serde(rename = "openaiKey")]
    pub openai_key: Option<String>,
    #[serde(rename = "isDownloaded")]
    pub is_downloaded: bool,
}

#[tauri::command]
pub fn get_current_embedding_model(app: tauri::AppHandle) -> Result<CurrentModelStatus, String> {
    use tauri_plugin_store::StoreExt;
    let cache_dir = app.path().app_cache_dir().ok();

    let (model_type, model_name, openai_key) = if let Ok(store) = app.store("store.json") {
        let model_type = store.get("embedding_model_type")
            .and_then(|v| v.as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| "local".to_string());
        let model_name = store.get("embedding_model_name")
            .and_then(|v| v.as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| "all-MiniLM-L6-v2".to_string());
        let openai_key = store.get("openai_api_key")
            .and_then(|v| v.as_str().map(|s| s.to_string()));
        (model_type, model_name, openai_key)
    } else {
        ("local".to_string(), "all-MiniLM-L6-v2".to_string(), None)
    };

    let is_downloaded = if model_type == "remote" {
        true
    } else if let Some(ref cache) = cache_dir {
        super::embedding::is_model_downloaded(cache, &model_name)
    } else {
        false
    };

    Ok(CurrentModelStatus {
        model_type,
        model_name,
        openai_key,
        is_downloaded,
    })
}

#[tauri::command]
pub async fn update_embedding_model_and_reindex(
    app: tauri::AppHandle,
    kb_state: State<'_, KbState>,
    embedder_state: State<'_, EmbedderState>,
    model_type: String,
    model_name: String,
    openai_key: Option<String>,
    workspace_root: String,
) -> Result<usize, String> {
    use tauri_plugin_store::StoreExt;
    
    // 1. Re-initialize embedder (forcing download since user requested this change)
    let cache_dir = app.path().app_cache_dir().ok();
    let new_embedder = super::embedding::init_embedder_with_config(
        cache_dir,
        &model_type,
        &model_name,
        openai_key.clone(),
        true,
    )?;
    let new_dims = new_embedder.dimensions();

    // 2. Save settings to store.json
    if let Ok(store) = app.store("store.json") {
        store.set("embedding_model_type", serde_json::json!(model_type));
        store.set("embedding_model_name", serde_json::json!(model_name));
        if let Some(ref key) = openai_key {
            store.set("openai_api_key", serde_json::json!(key));
        } else {
            // Remove the key if switching to local
            let _ = store.delete("openai_api_key");
        }
        let _ = store.save();
    }

    // 3. Drop/recreate vec0 table, delete document_chunks
    {
        let conn_arc = kb_state.0.db_lock();
        let mut conn = conn_arc.lock().await;
        
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        tx.execute("DROP TABLE IF EXISTS documents_embeddings;", []).map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM document_chunks;", []).map_err(|e| e.to_string())?;
        
        let create_vec = format!(
            "CREATE VIRTUAL TABLE IF NOT EXISTS documents_embeddings USING vec0(
                chunk_id    TEXT PRIMARY KEY,
                document_id TEXT,
                embedding   FLOAT[{new_dims}]
            );"
        );
        tx.execute_batch(&create_vec).map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
    }

    // 4. Update the shared embedder state
    {
        let mut active_embedder = embedder_state.0.write().await;
        *active_embedder = new_embedder;
    }

    // 5. Re-index all markdown files if workspace_root is valid
    let mut total_indexed = 0;
    if !workspace_root.is_empty() && std::path::Path::new(&workspace_root).exists() {
        let walker = ignore::WalkBuilder::new(&workspace_root)
            .hidden(false)
            .git_ignore(true)
            .git_exclude(true)
            .build();

        let mut files_to_index = Vec::new();
        for result in walker {
            if let Ok(entry) = result {
                if let Some(file_type) = entry.file_type() {
                    if file_type.is_file() {
                        let path = entry.path();
                        if path.extension().map_or(false, |ext| ext == "md") {
                            files_to_index.push(path.to_path_buf());
                        }
                    }
                }
            }
        }

        for path in files_to_index {
            if let Ok(content) = std::fs::read_to_string(&path) {
                let file_path_str = path.to_string_lossy().to_string();
                let title = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("Untitled")
                    .to_string();
                
                match kb_state.0.index_markdown_document_sections(
                    file_path_str,
                    title,
                    content,
                    vec![workspace_root.clone()],
                ).await {
                    Ok(count) => total_indexed += count,
                    Err(e) => eprintln!("Error indexing file {:?}: {}", path, e),
                }
            }
        }

        // Rebuild edges
        let _ = kb_state.0.rebuild_all_edges().await;
    }

    Ok(total_indexed)
}

#[tauri::command]
pub fn get_downloaded_models(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let cache_dir = app.path().app_cache_dir().ok();
    let mut downloaded = Vec::new();
    if let Some(ref cache) = cache_dir {
        let local_model_ids = vec![
            "all-MiniLM-L6-v2",
            "all-MiniLM-L12-v2",
            "bge-small-en-v1.5",
            "bge-base-en-v1.5",
            "bge-large-en-v1.5",
            "nomic-embed-text-v1.5",
            "multilingual-e5-small",
            "multilingual-e5-base",
            "multilingual-e5-large",
            "paraphrase-multilingual-MiniLM-L12-v2",
            "bge-small-zh-v1.5",
            "bge-large-zh-v1.5",
        ];
        for id in local_model_ids {
            if super::embedding::is_model_downloaded(cache, id) {
                downloaded.push(id.to_string());
            }
        }
    }
    Ok(downloaded)
}

#[tauri::command]
pub fn reveal_cache_dir(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(cache) = app.path().app_cache_dir().ok() {
        if !cache.exists() {
            let _ = std::fs::create_dir_all(&cache);
        }
        let path_str = cache.to_string_lossy().to_string();
        #[cfg(target_os = "macos")]
        {
            std::process::Command::new("open")
                .arg(&path_str)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("explorer")
                .arg(&path_str)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn get_dir_size(path: &std::path::Path) -> u64 {
    let mut total = 0;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if meta.is_dir() {
                    total += get_dir_size(&entry.path());
                } else {
                    total += meta.len();
                }
            }
        }
    }
    total
}

#[tauri::command]
pub fn get_model_download_size(app: tauri::AppHandle, model_name: String) -> u64 {
    let cache_dir = app.path().app_cache_dir().ok();
    let search_term = model_name.to_lowercase();
    if let Some(ref cache) = cache_dir {
        if let Ok(entries) = std::fs::read_dir(cache) {
            for entry in entries.flatten() {
                if let Ok(meta) = entry.metadata() {
                    if meta.is_dir() {
                        let name = entry.file_name().to_string_lossy().to_lowercase();
                        if name.starts_with("models--") && name.contains(&search_term) {
                            return get_dir_size(&entry.path());
                        }
                    }
                }
            }
        }
    }
    0
}

#[tauri::command]
pub fn get_cache_dir(app: tauri::AppHandle) -> Result<String, String> {
    if let Some(cache) = app.path().app_cache_dir().ok() {
        Ok(cache.to_string_lossy().to_string())
    } else {
        Err("Failed to resolve cache dir".to_string())
    }
}

#[tauri::command]
pub async fn download_embedding_model(
    app: tauri::AppHandle,
    model_name: String,
) -> Result<(), String> {
    let cache_dir = app.path().app_cache_dir().ok();
    let _ = super::embedding::init_embedder_with_config(
        cache_dir,
        "local",
        &model_name,
        None,
        true,
    )?;
    Ok(())
}



