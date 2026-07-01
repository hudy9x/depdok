use rusqlite::params;
use serde::Serialize;
use tauri::{State, Manager, Emitter};
use futures_util::StreamExt;
use tokio::io::AsyncWriteExt;
use std::fs;

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
pub async fn delete_connection(
    kb_state: State<'_, KbState>,
    source_id: String,
    target_id: String,
) -> Result<(), String> {
    let conn = kb_state.0.db_lock();
    let conn = conn.lock().await;

    let source_like = format!("{}#section:%", source_id);
    let target_like = format!("{}#section:%", target_id);

    conn.execute(
        "DELETE FROM edges 
         WHERE (source_id = ?1 OR source_id LIKE ?2) 
           AND (target_id = ?3 OR target_id LIKE ?4)",
        params![source_id, source_like, target_id, target_like],
    )
    .map_err(|e| format!("Failed to delete edge: {e}"))?;

    // Also in reverse
    conn.execute(
        "DELETE FROM edges 
         WHERE (source_id = ?1 OR source_id LIKE ?2) 
           AND (target_id = ?3 OR target_id LIKE ?4)",
        params![target_id, target_like, source_id, source_like],
    )
    .map_err(|e| format!("Failed to delete reverse edge: {e}"))?;

    Ok(())
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

struct ModelDownloadInfo {
    repo_id: &'static str,
    onnx_file: &'static str,
    additional_files: &'static [&'static str],
}

fn get_model_download_info(model_name: &str) -> Option<ModelDownloadInfo> {
    match model_name {
        "all-MiniLM-L6-v2" => Some(ModelDownloadInfo {
            repo_id: "Qdrant/all-MiniLM-L6-v2-onnx",
            onnx_file: "model.onnx",
            additional_files: &[],
        }),
        "all-MiniLM-L12-v2" => Some(ModelDownloadInfo {
            repo_id: "Xenova/all-MiniLM-L12-v2",
            onnx_file: "onnx/model.onnx",
            additional_files: &[],
        }),
        "bge-small-en-v1.5" => Some(ModelDownloadInfo {
            repo_id: "Xenova/bge-small-en-v1.5",
            onnx_file: "onnx/model.onnx",
            additional_files: &[],
        }),
        "bge-base-en-v1.5" => Some(ModelDownloadInfo {
            repo_id: "Xenova/bge-base-en-v1.5",
            onnx_file: "onnx/model.onnx",
            additional_files: &[],
        }),
        "bge-large-en-v1.5" => Some(ModelDownloadInfo {
            repo_id: "Xenova/bge-large-en-v1.5",
            onnx_file: "onnx/model.onnx",
            additional_files: &[],
        }),
        "nomic-embed-text-v1.5" => Some(ModelDownloadInfo {
            repo_id: "nomic-ai/nomic-embed-text-v1.5",
            onnx_file: "onnx/model.onnx",
            additional_files: &[],
        }),
        "multilingual-e5-small" => Some(ModelDownloadInfo {
            repo_id: "intfloat/multilingual-e5-small",
            onnx_file: "onnx/model.onnx",
            additional_files: &[],
        }),
        "multilingual-e5-base" => Some(ModelDownloadInfo {
            repo_id: "intfloat/multilingual-e5-base",
            onnx_file: "onnx/model.onnx",
            additional_files: &[],
        }),
        "multilingual-e5-large" => Some(ModelDownloadInfo {
            repo_id: "Qdrant/multilingual-e5-large-onnx",
            onnx_file: "model.onnx",
            additional_files: &["model.onnx_data"],
        }),
        "paraphrase-multilingual-MiniLM-L12-v2" => Some(ModelDownloadInfo {
            repo_id: "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
            onnx_file: "onnx/model.onnx",
            additional_files: &[],
        }),
        "bge-small-zh-v1.5" => Some(ModelDownloadInfo {
            repo_id: "Xenova/bge-small-zh-v1.5",
            onnx_file: "onnx/model.onnx",
            additional_files: &[],
        }),
        "bge-large-zh-v1.5" => Some(ModelDownloadInfo {
            repo_id: "Xenova/bge-large-zh-v1.5",
            onnx_file: "onnx/model.onnx",
            additional_files: &[],
        }),
        _ => None,
    }
}

async fn get_model_commit_sha(repo_id: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("https://huggingface.co/api/models/{}", repo_id);
    let res = client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .send()
        .await
        .map_err(|e| format!("Failed to get model info from HF: {}", e))?;
    
    if !res.status().is_success() {
        return Err(format!("HuggingFace API returned status code: {}", res.status()));
    }
    
    #[derive(serde::Deserialize)]
    struct HFModelInfo {
        sha: String,
    }
    
    let info = res.json::<HFModelInfo>().await
        .map_err(|e| format!("Failed to parse HF model info JSON: {}", e))?;
    
    Ok(info.sha)
}

#[derive(Clone, serde::Serialize)]
struct DownloadPayload {
    progress: f64,
    downloaded: u64,
    total: u64,
}

fn log_debug(app: &tauri::AppHandle, msg: &str) {
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S.%3f").to_string();
    let text = format!("[download_model][{}] {}\n", now, msg);
    print!("{}", text);
    use std::io::Write;
    let _ = std::io::stdout().flush();

    if let Some(cache) = app.path().app_cache_dir().ok() {
        let log_file = cache.join("download_debug.log");
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_file)
        {
            let _ = file.write_all(text.as_bytes());
        }
    }
}

#[tauri::command]
pub async fn download_embedding_model(
    app: tauri::AppHandle,
    model_name: String,
) -> Result<(), String> {
    let cache_dir = app.path().app_cache_dir().ok()
        .ok_or_else(|| "Failed to resolve cache directory".to_string())?;

    // Clear or initialize the log file
    let log_file = cache_dir.join("download_debug.log");
    if let Ok(mut file) = std::fs::File::create(&log_file) {
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S.%3f").to_string();
        let _ = std::io::Write::write_all(&mut file, format!("=== START DOWNLOAD FOR {} AT {} ===\n", model_name, now).as_bytes());
    }

    log_debug(&app, &format!("Starting custom model download for: {}", model_name));
    log_debug(&app, &format!("Log file is located at: {:?}", log_file));

    let info = get_model_download_info(&model_name)
        .ok_or_else(|| {
            let err_msg = format!("Unknown local model name: {}", model_name);
            log_debug(&app, &err_msg);
            err_msg
        })?;

    // 1. Get current commit sha from HF api
    log_debug(&app, &format!("Fetching commit SHA from HF API for repo: {}", info.repo_id));
    let sha = match get_model_commit_sha(info.repo_id).await {
        Ok(s) => {
            log_debug(&app, &format!("Resolved commit SHA: {}", s));
            s
        }
        Err(e) => {
            let err_msg = format!("Failed to get commit SHA: {}", e);
            log_debug(&app, &err_msg);
            return Err(err_msg);
        }
    };

    let repo_id_escaped = info.repo_id.replace("/", "--");
    let model_dir = cache_dir.join(format!("models--{}", repo_id_escaped));
    let target_dir = model_dir.join("snapshots").join(&sha);

    log_debug(&app, &format!("Target download directory: {:?}", target_dir));

    // Create directories
    if let Err(e) = fs::create_dir_all(&target_dir) {
        let err_msg = format!("Failed to create target directory: {}", e);
        log_debug(&app, &err_msg);
        return Err(err_msg);
    }

    let client = reqwest::Client::new();

    // 2. Download small metadata files first (if present)
    let meta_files = vec![
        "config.json",
        "tokenizer.json",
        "tokenizer_config.json",
        "special_tokens_map.json",
    ];

    for file_name in meta_files {
        let file_url = format!("https://huggingface.co/{}/resolve/{}/{}", info.repo_id, sha, file_name);
        log_debug(&app, &format!("Fetching metadata file: {} from URL: {}", file_name, file_url));
        let res = client.get(&file_url)
            .header("User-Agent", "Mozilla/5.0")
            .send()
            .await;
        
        match res {
            Ok(response) => {
                let status = response.status();
                log_debug(&app, &format!("Metadata file {} response status: {}", file_name, status));
                if status.is_success() {
                    match response.bytes().await {
                        Ok(bytes) => {
                            let dest = target_dir.join(file_name);
                            if let Err(e) = fs::write(&dest, &bytes) {
                                log_debug(&app, &format!("Failed to write metadata file to {:?}: {}", dest, e));
                            } else {
                                log_debug(&app, &format!("Successfully saved metadata file: {} ({} bytes)", file_name, bytes.len()));
                            }
                        }
                        Err(e) => {
                            log_debug(&app, &format!("Failed to read bytes for metadata file {}: {}", file_name, e));
                        }
                    }
                } else {
                    log_debug(&app, &format!("Metadata file {} not found or failed (status: {})", file_name, status));
                }
            }
            Err(e) => {
                log_debug(&app, &format!("Failed to request metadata file {}: {}", file_name, e));
            }
        }
    }

    // 3. Download the main ONNX file and additional files with progress tracking
    let mut files_to_track = vec![info.onnx_file];
    for f in info.additional_files {
        files_to_track.push(f);
    }

    log_debug(&app, &format!("Files to track/download: {:?}", files_to_track));

    // Calculate total size first for progress calculation
    let mut total_size: u64 = 0;
    let mut file_sizes = Vec::new();

    for file_name in &files_to_track {
        let file_url = format!("https://huggingface.co/{}/resolve/{}/{}", info.repo_id, sha, file_name);
        log_debug(&app, &format!("Sending GET request (headers only) to resolve size of {} at URL: {}", file_name, file_url));
        let res = match client.get(&file_url)
            .header("User-Agent", "Mozilla/5.0")
            .send()
            .await {
                Ok(r) => r,
                Err(e) => {
                    let err_msg = format!("GET size request failed for {}: {}", file_name, e);
                    log_debug(&app, &err_msg);
                    return Err(err_msg);
                }
            };
        
        let status = res.status();
        log_debug(&app, &format!("GET size request status for {}: {}", file_name, status));
        if !status.is_success() {
            let err_msg = format!("GET size request returned non-success status for {}: {}", file_name, status);
            log_debug(&app, &err_msg);
            return Err(err_msg);
        }

        let size = match res.content_length() {
            Some(s) => s,
            None => {
                let err_msg = format!("Could not resolve content length for {}", file_name);
                log_debug(&app, &err_msg);
                return Err(err_msg);
            }
        };
        total_size += size;
        file_sizes.push(size);
        log_debug(&app, &format!("File {} resolved to {} bytes ({:.2} MB)", file_name, size, size as f64 / 1024.0 / 1024.0));
    }
    log_debug(&app, &format!("Total download size for all tracked files: {} bytes ({:.2} MB)", total_size, total_size as f64 / 1024.0 / 1024.0));

    let mut downloaded: u64 = 0;
    let mut last_emitted_pct: Option<u64> = None;
    let mut chunk_count = 0;

    for file_name in files_to_track {
        let file_url = format!("https://huggingface.co/{}/resolve/{}/{}", info.repo_id, sha, file_name);
        log_debug(&app, &format!("Sending GET request to start download stream for: {}", file_name));
        let response = match client.get(&file_url)
            .header("User-Agent", "Mozilla/5.0")
            .send()
            .await {
                Ok(r) => r,
                Err(e) => {
                    let err_msg = format!("Download request failed for {}: {}", file_name, e);
                    log_debug(&app, &err_msg);
                    return Err(err_msg);
                }
            };

        let status = response.status();
        log_debug(&app, &format!("GET response status for {}: {}", file_name, status));
        if !status.is_success() {
            let err_msg = format!("GET request returned non-success status for {}: {}", file_name, status);
            log_debug(&app, &err_msg);
            return Err(err_msg);
        }

        let file_total_size = response.content_length().unwrap_or(0);
        log_debug(&app, &format!("Streaming GET response Content-Length for {} is {} bytes", file_name, file_total_size));
        if total_size == 0 || total_size < downloaded + file_total_size {
            total_size = if total_size == 0 { file_total_size } else { total_size.max(downloaded + file_total_size) };
            log_debug(&app, &format!("Adjusted total_size dynamically to {}", total_size));
        }

        let dest_path = target_dir.join(file_name);
        if let Some(parent) = dest_path.parent() {
            if let Err(e) = fs::create_dir_all(parent) {
                let err_msg = format!("Failed to create parent directory for file {:?}: {}", dest_path, e);
                log_debug(&app, &err_msg);
                return Err(err_msg);
            }
        }

        log_debug(&app, &format!("Creating file at path: {:?}", dest_path));
        let mut file = match tokio::fs::File::create(&dest_path).await {
            Ok(f) => f,
            Err(e) => {
                let err_msg = format!("Failed to create file {:?}: {}", dest_path, e);
                log_debug(&app, &err_msg);
                return Err(err_msg);
            }
        };
        let mut stream = response.bytes_stream();

        log_debug(&app, &format!("Entering stream chunk loop for {}", file_name));
        while let Some(chunk_result) = stream.next().await {
            chunk_count += 1;
            let chunk = match chunk_result {
                Ok(c) => c,
                Err(e) => {
                    let err_msg = format!("Error reading stream chunk #{}: {}", chunk_count, e);
                    log_debug(&app, &err_msg);
                    return Err(err_msg);
                }
            };

            if let Err(e) = file.write_all(&chunk).await {
                let err_msg = format!("Failed to write chunk #{} (size: {}) to disk: {}", chunk_count, chunk.len(), e);
                log_debug(&app, &err_msg);
                return Err(err_msg);
            }

            downloaded += chunk.len() as u64;
            let progress = (downloaded as f64 / total_size as f64) * 100.0;
            let current_pct = progress.floor() as u64;

            // Log every 50 chunks to trace activity without spamming stdout too much (still written to log_debug)
            if chunk_count % 50 == 0 {
                log_debug(&app, &format!("Stream progress: chunk #{}, chunk_size={} bytes, total_downloaded={} bytes, progress={:.2}%", 
                    chunk_count, chunk.len(), downloaded, progress));
            }

            if last_emitted_pct.map_or(true, |last| current_pct > last) {
                last_emitted_pct = Some(current_pct);
                let msg = format!("Emitting download-progress event: progress={:.2}%, bytes={}/{}, chunks={}", progress, downloaded, total_size, chunk_count);
                log_debug(&app, &msg);

                // Emit progress event
                if let Err(e) = app.emit("download-progress", DownloadPayload {
                    progress,
                    downloaded,
                    total: total_size,
                }) {
                    log_debug(&app, &format!("WARNING: failed to emit event: {:?}", e));
                }
            }
        }
        log_debug(&app, &format!("Completed stream chunk loop for file {}. Total chunks: {}", file_name, chunk_count));
    }

    // 4. Write ref main
    let refs_dir = model_dir.join("refs");
    log_debug(&app, &format!("Writing ref main reference... refs_dir: {:?}", refs_dir));
    if let Err(e) = fs::create_dir_all(&refs_dir) {
        let err_msg = format!("Failed to create refs directory: {}", e);
        log_debug(&app, &err_msg);
        return Err(err_msg);
    }
    if let Err(e) = fs::write(refs_dir.join("main"), &sha) {
        let err_msg = format!("Failed to write refs/main: {}", e);
        log_debug(&app, &err_msg);
        return Err(err_msg);
    }
    log_debug(&app, &format!("Reference main successfully set to SHA: {}", sha));

    log_debug(&app, "Custom download process finished successfully!");
    Ok(())
}

#[tauri::command]
pub fn delete_embedding_model(
    app: tauri::AppHandle,
    model_name: String,
) -> Result<(), String> {
    let cache_dir = app.path().app_cache_dir().ok();
    let search_term = model_name.to_lowercase();
    if let Some(ref cache) = cache_dir {
        if let Ok(entries) = std::fs::read_dir(cache) {
            for entry in entries.flatten() {
                if let Ok(meta) = entry.metadata() {
                    if meta.is_dir() {
                        let name = entry.file_name().to_string_lossy().to_lowercase();
                        if name.starts_with("models--") && name.contains(&search_term) {
                            std::fs::remove_dir_all(entry.path())
                                .map_err(|e| format!("Failed to delete model directory: {}", e))?;
                        }
                    }
                }
            }
        }
    }
    Ok(())
}




