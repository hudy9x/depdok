use serde_json::json;
use std::fs;
use std::path::Path;

pub fn read_file(path: &str) -> Result<String, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    Ok(json!({ "content": content }).to_string())
}

pub fn write_file(path: &str, content: &str) -> Result<String, String> {
    if let Some(parent) = Path::new(path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directories: {}", e))?;
    }
    fs::write(path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(json!({ "success": true }).to_string())
}

pub fn list_directory(path: &str) -> Result<String, String> {
    let entries: Vec<serde_json::Value> = fs::read_dir(path)
        .map_err(|e| format!("Failed to list directory: {}", e))?
        .filter_map(|e| e.ok())
        .map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            let is_dir = e.file_type().map(|t| t.is_dir()).unwrap_or(false);
            json!({ "name": name, "is_dir": is_dir })
        })
        .collect();
    Ok(json!({ "entries": entries }).to_string())
}
