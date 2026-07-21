use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_store::StoreExt;

use super::provider::{LlmConfig, LlmState};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GgufModelInfo {
    pub filename: String,
    pub path: String,
    pub size_bytes: u64,
}

/// Resolve the models directory.
/// Uses the app data directory (same base location as the knowledge base DB)
/// and stores models under an `llm-models` subfolder.
pub fn get_models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(custom_dir) = resolve_custom_models_dir(app)? {
        ensure_models_dir(&custom_dir)?;
        println!("[llm][models] Resolved models dir to custom path: {:?}", custom_dir);
        return Ok(custom_dir);
    }

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;
    let models_dir = app_data_dir.join("llm-models");

    ensure_models_dir(&models_dir)?;

    println!("[llm][models] Resolved models dir to: {:?}", models_dir);
    Ok(models_dir)
}

fn resolve_custom_models_dir(app: &AppHandle) -> Result<Option<PathBuf>, String> {
    if let Some(state) = app.try_state::<LlmState>() {
        let config = state.config.lock().unwrap().clone();
        if let Some(custom_dir) = config.custom_models_dir {
            let trimmed = custom_dir.trim();
            if !trimmed.is_empty() {
                return Ok(Some(PathBuf::from(trimmed)));
            }
        }
    }

    if let Ok(store) = app.store("store.json") {
        if let Some(val) = store.get("llm_config") {
            if let Ok(config) = serde_json::from_value::<LlmConfig>(val) {
                if let Some(custom_dir) = config.custom_models_dir {
                    let trimmed = custom_dir.trim();
                    if !trimmed.is_empty() {
                        return Ok(Some(PathBuf::from(trimmed)));
                    }
                }
            }
        }
    }

    Ok(None)
}

fn ensure_models_dir(models_dir: &PathBuf) -> Result<(), String> {
    if !models_dir.exists() {
        fs::create_dir_all(models_dir)
            .map_err(|e| format!("Failed to create models directory: {}", e))?;
    }

    Ok(())
}

/// Scan the models directory for .gguf files.
pub fn scan_models(app: &AppHandle) -> Result<Vec<GgufModelInfo>, String> {
    let models_dir = get_models_dir(app)?;
    println!("[llm][models] Scanning models directory: {:?}", models_dir);

    if !models_dir.exists() {
        println!("[llm][models] Directory does not exist, creating: {:?}", models_dir);
        fs::create_dir_all(&models_dir)
            .map_err(|e| format!("Failed to create models directory: {}", e))?;
        return Ok(vec![]);
    }

    let mut models = Vec::new();
    let entries = fs::read_dir(&models_dir)
        .map_err(|e| format!("Failed to read models directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        let filename = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        if filename.ends_with(".gguf") {
            let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
            println!("[llm][models] Found model: {} ({} bytes)", filename, size_bytes);
            models.push(GgufModelInfo {
                filename: filename.clone(),
                path: path.to_string_lossy().to_string(),
                size_bytes,
            });
        }
    }

    models.sort_by(|a, b| a.filename.cmp(&b.filename));
    println!("[llm][models] Scan completed. Found {} models total.", models.len());
    Ok(models)
}

/// Delete a GGUF model file.
pub fn delete_model(app: &AppHandle, filename: &str) -> Result<(), String> {
    let models_dir = get_models_dir(app)?;
    let path = models_dir.join(filename);

    // Safety: only delete .gguf files within the models directory
    if !filename.ends_with(".gguf") {
        return Err("Only .gguf files can be deleted".to_string());
    }

    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to delete model: {}", e))?;
    }
    Ok(())
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgress {
    pub progress: f64, // 0.0 - 100.0
}

/// Download a GGUF model from a URL into the models directory with progress events.
pub async fn download_model(
    app: AppHandle,
    url: String,
    filename: String,
) -> Result<(), String> {
    use futures_util::StreamExt;

    let models_dir = get_models_dir(&app)?;
    fs::create_dir_all(&models_dir)
        .map_err(|e| format!("Failed to create models directory: {}", e))?;

    // Validate filename
    if !filename.ends_with(".gguf") {
        return Err("Filename must end with .gguf".to_string());
    }

    let dest = models_dir.join(&filename);

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Download request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {} while downloading model", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;

    let mut file = tokio::fs::File::create(&dest)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;

    let mut stream = response.bytes_stream();

    use tokio::io::AsyncWriteExt;
    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| format!("Download chunk error: {}", e))?;
        file.write_all(&bytes)
            .await
            .map_err(|e| format!("Failed to write chunk: {}", e))?;

        downloaded += bytes.len() as u64;
        if total_size > 0 {
            let progress = (downloaded as f64 / total_size as f64) * 100.0;
            let _ = app.emit("llm-model-download-progress", progress as u32);
        }
    }

    file.flush()
        .await
        .map_err(|e| format!("Failed to flush file: {}", e))?;

    // Emit 100% completion
    let _ = app.emit("llm-model-download-progress", 100u32);
    Ok(())
}

/// Open the models directory in Finder/Explorer.
pub fn reveal_models_dir(app: &AppHandle) -> Result<(), String> {
    let models_dir = get_models_dir(app)?;
    fs::create_dir_all(&models_dir)
        .map_err(|e| format!("Failed to create models directory: {}", e))?;
    tauri_plugin_opener::open_path(models_dir.to_string_lossy().as_ref(), None::<&str>)
        .map_err(|e| format!("Failed to reveal directory: {}", e))
}
