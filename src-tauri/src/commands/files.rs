use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::Command;
use fs_extra;

#[cfg(target_os = "macos")]
fn show_in_finder(path: &str) {
    Command::new("open")
        .arg("-R")
        .arg(path)
        .spawn()
        .unwrap();
}

#[cfg(target_os = "windows")]
fn show_in_explorer(path: &str) {
    Command::new("explorer")
        .arg("/select,")
        .arg(path)
        .spawn()
        .unwrap();
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    children: Option<Vec<FileEntry>>,
}

#[tauri::command]
pub fn reveal_file(path: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    show_in_finder(path);
    #[cfg(target_os = "windows")]
    show_in_explorer(path);
    Ok(())
}

#[tauri::command]
pub fn list_dir(path: &str) -> Result<Vec<FileEntry>, String> {
    let path = Path::new(path);
    if !path.exists() {
        return Err("Path does not exist".to_string());
    }

    let mut entries = Vec::new();
    let read_dir = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in read_dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        let is_dir = path.is_dir();

        // Skip hidden files/dirs (starting with .)
        if name.starts_with('.') {
            continue;
        }

        entries.push(FileEntry {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir,
            children: None, // We don't recursively load for now, frontend can request on expand
        });
    }

    // Sort: directories first, then files
    entries.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.cmp(&b.name)
        } else if a.is_dir {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    Ok(entries)
}

#[tauri::command]
pub fn read_file_content(path: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_file_content(path: &str, content: &str) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_binary_file(path: &str, data: Vec<u8>) -> Result<(), String> {
    fs::write(path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_directory(path: &str) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_file(path: &str) -> Result<(), String> {
    fs::File::create(path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_node(path: &str) -> Result<(), String> {
    let path = Path::new(path);
    if path.is_dir() {
        fs::remove_dir_all(path).map_err(|e| e.to_string())
    } else {
        fs::remove_file(path).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn rename_node(old_path: &str, new_path: &str) -> Result<(), String> {
    fs::rename(old_path, new_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn copy_node(source: &str, destination: &str) -> Result<(), String> {
    let source_path = Path::new(source);
    if source_path.is_dir() {
        // Recursive copy for directory
        let options = fs_extra::dir::CopyOptions::new().content_only(true);
        fs_extra::dir::copy(source, destination, &options).map_err(|e| e.to_string())?;
    } else {
        // File copy
        fs::copy(source, destination).map_err(|e| e.to_string())?;
    }
    Ok(())
}
