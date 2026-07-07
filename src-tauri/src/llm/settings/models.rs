use tauri::AppHandle;
use crate::llm::models::{self, GgufModelInfo};

#[tauri::command]
pub fn scan_local_llm_models(app: AppHandle) -> Result<Vec<GgufModelInfo>, String> {
    println!("[llm][command] scan_local_llm_models requested");
    let result = models::scan_models(&app);
    match &result {
        Ok(lst) => println!("[llm][models] Scanned and found {} local GGUF models", lst.len()),
        Err(err) => println!("[llm][models] Failed to scan models: {}", err),
    }
    result
}

#[tauri::command]
pub async fn download_llm_model(
    app: AppHandle,
    url: String,
    filename: String,
) -> Result<(), String> {
    println!("[llm][command] download_llm_model: filename={}, url={}", filename, url);
    let result = models::download_model(app, url, filename.clone()).await;
    match &result {
        Ok(_) => println!("[llm][models] Model download completed successfully: {}", filename),
        Err(err) => println!("[llm][models] Model download failed: {}", err),
    }
    result
}

#[tauri::command]
pub fn delete_llm_model(app: AppHandle, filename: String) -> Result<(), String> {
    println!("[llm][command] delete_llm_model: filename={}", filename);
    let result = models::delete_model(&app, &filename);
    match &result {
        Ok(_) => println!("[llm][models] Model deleted successfully: {}", filename),
        Err(err) => println!("[llm][models] Model deletion failed: {}", err),
    }
    result
}

#[tauri::command]
pub fn reveal_llm_models_dir(app: AppHandle) -> Result<(), String> {
    println!("[llm][command] reveal_llm_models_dir requested");
    models::reveal_models_dir(&app)
}

#[tauri::command]
pub fn get_llm_models_dir(app: AppHandle) -> Result<String, String> {
    models::get_models_dir(&app)
        .map(|p| p.to_string_lossy().to_string())
}
