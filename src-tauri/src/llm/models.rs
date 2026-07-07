use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GgufModelInfo {
    pub filename: String,
    pub path: String,
    pub size_bytes: u64,
}

/// Resolve the models directory.
/// - In dev mode: ascends from the executable path to find the repository's models folder.
/// - In production / fallback: uses the app's cache directory (matching the knowledge_base convention).
pub fn get_models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(debug_assertions)]
    {
        if let Ok(exe_path) = std::env::current_exe() {
            println!("[llm][models] current_exe: {:?}", exe_path);
            let mut path = exe_path;
            // Ascend up to 5 levels to locate the repository models folder
            for i in 0..5 {
                if let Some(parent) = path.parent() {
                    path = parent.to_path_buf();
                    
                    let dev_path1 = path.join("src-tauri").join("models");
                    println!("[llm][models] Level {}: Checking dev_path1 exists: {:?} -> {}", i, dev_path1, dev_path1.exists());
                    if dev_path1.exists() {
                        println!("[llm][models] Resolved models dir to: {:?}", dev_path1);
                        return Ok(dev_path1);
                    }
                    
                    let dev_path2 = path.join("models");
                    println!("[llm][models] Level {}: Checking dev_path2 exists: {:?} -> {}", i, dev_path2, dev_path2.exists());
                    if dev_path2.exists() {
                        println!("[llm][models] Resolved models dir to: {:?}", dev_path2);
                        return Ok(dev_path2);
                    }
                } else {
                    break;
                }
            }
        }
    }

    // Production / Fallback: use app cache directory's "models" subfolder
    if let Ok(cache_dir) = app.path().app_cache_dir() {
        let models_dir = cache_dir.join("models");
        println!("[llm][models] Falling back to app cache models dir: {:?}", models_dir);
        if !models_dir.exists() {
            let _ = fs::create_dir_all(&models_dir);
        }
        return Ok(models_dir);
    }

    // Ultimate fallback: resource directory
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;
    let fallback_dir = resource_dir.join("models");
    println!("[llm][models] Falling back to app resources models dir: {:?}", fallback_dir);
    Ok(fallback_dir)
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
