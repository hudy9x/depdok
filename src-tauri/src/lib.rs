// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::sync::{Arc, Mutex};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder, Emitter};
use tauri_plugin_store::StoreExt;

const MIN_WINDOW_WIDTH: f64 = 609.0;
const MIN_WINDOW_HEIGHT: f64 = 627.0;

// Global state to store the opened file path
struct OpenedFilePath(Mutex<Option<String>>);

#[derive(Clone, serde::Serialize, serde::Deserialize, Debug)]
pub struct PendingPath {
    pub path: String,
    pub is_dir: bool,
    pub exists: bool,
}

pub struct PendingOpenPaths(pub Mutex<Vec<PendingPath>>);

fn normalize_path(path: &std::path::Path) -> String {
    let s = path.to_string_lossy().to_string();
    #[cfg(target_os = "windows")]
    {
        let s = s.replace("/", "\\");
        if s.starts_with(r"\\?\") {
            s[4..].to_string()
        } else {
            s
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        s
    }
}

fn resolve_and_normalize_path(base_dir: &std::path::Path, arg: &str) -> PendingPath {
    let path = std::path::PathBuf::from(arg);
    let resolved = if path.is_absolute() {
        path
    } else {
        base_dir.join(path)
    };
    
    let (final_path, exists) = if resolved.exists() {
        if let Ok(canon) = resolved.canonicalize() {
            (canon, true)
        } else {
            (resolved, true)
        }
    } else {
        (resolved, false)
    };
    
    let normalized = normalize_path(&final_path);
    let is_dir = exists && final_path.is_dir();
    
    PendingPath {
        path: normalized,
        is_dir,
        exists,
    }
}

#[cfg(target_os = "windows")]
fn parse_reg_path_output(output: &str) -> Option<(String, String)> {
    for line in output.lines() {
        if line.trim().starts_with("PATH") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                let reg_type = parts[1].to_string();
                if let Some(type_idx) = line.find(&reg_type) {
                    let val_start = type_idx + reg_type.len();
                    let path_val = line[val_start..].trim().to_string();
                    return Some((reg_type, path_val));
                }
            }
        }
    }
    None
}

#[tauri::command]
fn get_pending_open_paths(state: tauri::State<'_, PendingOpenPaths>) -> Vec<PendingPath> {
    let mut guard = state.0.lock().unwrap();
    std::mem::take(&mut *guard)
}

#[tauri::command]
async fn install_cli() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::fs;
        use std::process::Command;

        let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
        let exe_dir = exe_path.parent().ok_or_else(|| "Failed to get exe directory".to_string())?;
        
        // 1. Write depdok.cmd shim
        let shim_path = exe_dir.join("depdok.cmd");
        let shim_content = format!(
            "@echo off\r\nstart \"\" \"{}\" %*\r\n",
            exe_path.to_string_lossy()
        );
        fs::write(&shim_path, shim_content).map_err(|e| format!("Failed to write shim: {}", e))?;
        
        // 2. Add exe_dir to user PATH registry if not already present
        let output = Command::new("reg")
            .args(&["query", "HKCU\\Environment", "/v", "PATH"])
            .output()
            .map_err(|e| format!("Failed to read registry: {}", e))?;
        
        let path_str = String::from_utf8_lossy(&output.stdout);
        let (reg_type, current_path) = if output.status.success() {
            parse_reg_path_output(&path_str).unwrap_or(("REG_EXPAND_SZ".to_string(), "".to_string()))
        } else {
            ("REG_EXPAND_SZ".to_string(), "".to_string())
        };

        let target_dir = exe_dir.to_string_lossy().to_string();
        let paths: Vec<&str> = current_path.split(';').map(|s| s.trim()).collect();
        if !paths.contains(&target_dir.as_str()) {
            let new_path = if current_path.is_empty() {
                target_dir
            } else {
                format!("{};{}", current_path, target_dir)
            };
            
            let status = Command::new("reg")
                .args(&["add", "HKCU\\Environment", "/v", "PATH", "/t", &reg_type, "/d", &new_path, "/f"])
                .status()
                .map_err(|e| format!("Failed to update registry PATH variable: {}", e))?;
                
            if !status.success() {
                return Err("Failed to update registry PATH variable".to_string());
            }
        }
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::fs;
        use std::os::unix::fs::symlink;
        use std::process::Command;

        let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
        let symlink_path = std::path::Path::new("/usr/local/bin/depdok");
        
        if let Some(parent) = symlink_path.parent() {
            if !parent.exists() {
                let _ = fs::create_dir_all(parent);
            }
        }

        if symlink_path.exists() {
            let _ = fs::remove_file(symlink_path);
        }
        
        if let Err(_) = symlink(&exe_path, symlink_path) {
            #[cfg(target_os = "macos")]
            {
                let prompt_cmd = format!(
                    "do shell script \"ln -sf '{}' '/usr/local/bin/depdok'\" with administrator privileges",
                    exe_path.to_string_lossy()
                );
                let status = Command::new("osascript")
                    .args(&["-e", &prompt_cmd])
                    .status()
                    .map_err(|e| format!("Failed to request admin privileges via osascript: {}", e))?;
                    
                if !status.success() {
                    return Err("Failed to create symlink with admin privileges".to_string());
                }
            }
            
            #[cfg(target_os = "linux")]
            {
                let status = Command::new("pkexec")
                    .args(&["ln", "-sf", &exe_path.to_string_lossy(), "/usr/local/bin/depdok"])
                    .status()
                    .map_err(|e| format!("Failed to request admin privileges via pkexec: {}", e))?;
                    
                if !status.success() {
                    return Err("Failed to create symlink with admin privileges".to_string());
                }
            }
        }
        Ok(())
    }
}

#[tauri::command]
async fn uninstall_cli() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::fs;
        use std::process::Command;

        let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
        let exe_dir = exe_path.parent().ok_or_else(|| "Failed to get exe directory".to_string())?;
        
        // 1. Delete depdok.cmd shim
        let shim_path = exe_dir.join("depdok.cmd");
        if shim_path.exists() {
            let _ = fs::remove_file(shim_path);
        }
        
        // 2. Remove from PATH
        let output = Command::new("reg")
            .args(&["query", "HKCU\\Environment", "/v", "PATH"])
            .output()
            .map_err(|e| format!("Failed to read registry: {}", e))?;
            
        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout);
            if let Some((reg_type, current_path)) = parse_reg_path_output(&path_str) {
                let target_dir = exe_dir.to_string_lossy().to_string();
                let paths: Vec<&str> = current_path.split(';').map(|s| s.trim()).collect();
                if paths.contains(&target_dir.as_str()) {
                    let remaining_paths: Vec<&str> = paths.into_iter().filter(|&p| p != target_dir).collect();
                    let new_path = remaining_paths.join(";");
                    
                    let status = Command::new("reg")
                        .args(&["add", "HKCU\\Environment", "/v", "PATH", "/t", &reg_type, "/d", &new_path, "/f"])
                        .status()
                        .map_err(|e| format!("Failed to update registry: {}", e))?;
                        
                    if !status.success() {
                        return Err("Failed to update registry PATH variable".to_string());
                    }
                }
            }
        }
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::fs;
        use std::process::Command;

        let symlink_path = std::path::Path::new("/usr/local/bin/depdok");
        if symlink_path.exists() {
            if let Err(_) = fs::remove_file(symlink_path) {
                #[cfg(target_os = "macos")]
                {
                    let prompt_cmd = "do shell script \"rm -f '/usr/local/bin/depdok'\" with administrator privileges";
                    let status = Command::new("osascript")
                        .args(&["-e", prompt_cmd])
                        .status()
                        .map_err(|e| e.to_string())?;
                    if !status.success() {
                        return Err("Failed to remove symlink with admin privileges".to_string());
                    }
                }
                #[cfg(target_os = "linux")]
                {
                    let status = Command::new("pkexec")
                        .args(&["rm", "-f", "/usr/local/bin/depdok"])
                        .status()
                        .map_err(|e| e.to_string())?;
                    if !status.success() {
                        return Err("Failed to remove symlink with admin privileges".to_string());
                    }
                }
            }
        }
        Ok(())
    }
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct CliInfo {
    pub is_installed: bool,
    pub cli_path: String,
}

#[tauri::command]
async fn get_cli_info() -> Result<CliInfo, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
        let exe_dir = exe_path.parent().ok_or_else(|| "Failed to get exe directory".to_string())?;
        let cli_path = exe_dir.to_string_lossy().to_string();
        
        let shim_path = exe_dir.join("depdok.cmd");
        if !shim_path.exists() {
            return Ok(CliInfo { is_installed: false, cli_path });
        }
        
        let output = Command::new("reg")
            .args(&["query", "HKCU\\Environment", "/v", "PATH"])
            .output()
            .map_err(|e| e.to_string())?;
            
        if !output.status.success() {
            return Ok(CliInfo { is_installed: false, cli_path });
        }
        
        let path_str = String::from_utf8_lossy(&output.stdout);
        if let Some((_, current_path)) = parse_reg_path_output(&path_str) {
            let target_dir = exe_dir.to_string_lossy().to_string();
            let paths: Vec<&str> = current_path.split(';').map(|s| s.trim()).collect();
            let is_installed = paths.contains(&target_dir.as_str());
            Ok(CliInfo { is_installed, cli_path })
        } else {
            Ok(CliInfo { is_installed: false, cli_path })
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let symlink_path = std::path::Path::new("/usr/local/bin/depdok");
        let cli_path = "/usr/local/bin".to_string();
        if !symlink_path.exists() {
            return Ok(CliInfo { is_installed: false, cli_path });
        }
        if let Ok(metadata) = std::fs::symlink_metadata(symlink_path) {
            let is_installed = metadata.file_type().is_symlink();
            Ok(CliInfo { is_installed, cli_path })
        } else {
            Ok(CliInfo { is_installed: false, cli_path })
        }
    }
}

#[tauri::command]
async fn check_context_menu_status() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        let output = Command::new("reg")
            .args(&["query", "HKCU\\Software\\Classes\\*\\shell\\Depdok"])
            .output()
            .map_err(|e| e.to_string())?;
            
        Ok(output.status.success())
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

#[tauri::command]
async fn register_context_menu() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
        let exe_path_str = exe_path.to_string_lossy().to_string();
        let icon_str = format!("{},0", exe_path_str);
        
        // 1. File Context Menu
        Command::new("reg")
            .args(&["add", "HKCU\\Software\\Classes\\*\\shell\\Depdok", "/ve", "/d", "Open with Depdok", "/f"])
            .status()
            .map_err(|e| e.to_string())?;
        Command::new("reg")
            .args(&["add", "HKCU\\Software\\Classes\\*\\shell\\Depdok", "/v", "Icon", "/d", &icon_str, "/f"])
            .status()
            .map_err(|e| e.to_string())?;
        let cmd_val = format!("\"{}\" \"%1\"", exe_path_str);
        Command::new("reg")
            .args(&["add", "HKCU\\Software\\Classes\\*\\shell\\Depdok\\command", "/ve", "/d", &cmd_val, "/f"])
            .status()
            .map_err(|e| e.to_string())?;

        // 2. Directory Context Menu
        Command::new("reg")
            .args(&["add", "HKCU\\Software\\Classes\\Directory\\shell\\Depdok", "/ve", "/d", "Open Folder with Depdok", "/f"])
            .status()
            .map_err(|e| e.to_string())?;
        Command::new("reg")
            .args(&["add", "HKCU\\Software\\Classes\\Directory\\shell\\Depdok", "/v", "Icon", "/d", &icon_str, "/f"])
            .status()
            .map_err(|e| e.to_string())?;
        let dir_cmd_val = format!("\"{}\" \"%V\"", exe_path_str);
        Command::new("reg")
            .args(&["add", "HKCU\\Software\\Classes\\Directory\\shell\\Depdok\\command", "/ve", "/d", &dir_cmd_val, "/f"])
            .status()
            .map_err(|e| e.to_string())?;

        // 3. Directory Background Context Menu
        Command::new("reg")
            .args(&["add", "HKCU\\Software\\Classes\\Directory\\Background\\shell\\Depdok", "/ve", "/d", "Open Folder with Depdok", "/f"])
            .status()
            .map_err(|e| e.to_string())?;
        Command::new("reg")
            .args(&["add", "HKCU\\Software\\Classes\\Directory\\Background\\shell\\Depdok", "/v", "Icon", "/d", &icon_str, "/f"])
            .status()
            .map_err(|e| e.to_string())?;
        Command::new("reg")
            .args(&["add", "HKCU\\Software\\Classes\\Directory\\Background\\shell\\Depdok\\command", "/ve", "/d", &dir_cmd_val, "/f"])
            .status()
            .map_err(|e| e.to_string())?;

        Ok(())
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
    }
}

#[tauri::command]
async fn unregister_context_menu() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        Command::new("reg")
            .args(&["delete", "HKCU\\Software\\Classes\\*\\shell\\Depdok", "/f"])
            .status()
            .map_err(|e| e.to_string())?;
            
        Command::new("reg")
            .args(&["delete", "HKCU\\Software\\Classes\\Directory\\shell\\Depdok", "/f"])
            .status()
            .map_err(|e| e.to_string())?;
            
        Command::new("reg")
            .args(&["delete", "HKCU\\Software\\Classes\\Directory\\Background\\shell\\Depdok", "/f"])
            .status()
            .map_err(|e| e.to_string())?;
            
        Ok(())
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_opened_file_path(state: tauri::State<OpenedFilePath>) -> Option<String> {
    state.0.lock().unwrap().clone()
}

#[tauri::command]
fn toggle_devtools(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_devtools_open() {
            let _ = window.close_devtools();
        } else {
            let _ = window.open_devtools();
        }
    }
}

#[tauri::command]
fn open_devtools(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.open_devtools();
    }
}

#[tauri::command]
fn close_devtools(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.close_devtools();
    }
}

mod commands;
mod menu;
mod license_manager;
mod keychain;
mod knowledge_base;
pub mod mcp_server;
mod llm;
#[cfg(target_os = "macos")]
mod dock;

#[tauri::command]
fn open_new_window(app: tauri::AppHandle) -> Result<(), String> {
    let label = format!("window-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis());

    let win_builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::default())
        .title("Depdok")
        .inner_size(740.0, 850.0)
        .min_inner_size(MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT)
        .decorations(false)
        .disable_drag_drop_handler();

    #[cfg(target_os = "windows")]
    let win_builder = win_builder
        .transparent(false)
        .background_color(tauri::window::Color(24, 24, 24, 255));

    #[cfg(not(target_os = "windows"))]
    let win_builder = win_builder.transparent(true);

    #[cfg(target_os = "macos")]
    let window = win_builder.build().map_err(|e| e.to_string())?;

    #[cfg(not(target_os = "macos"))]
    let _window = win_builder.build().map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    {
        use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
        apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, Some(10.0))
            .map_err(|e| format!("Vibrancy error: {:?}", e))?;
    }

    Ok(())
}

/// Update the macOS dock menu with recent folders and a \"New Window\" entry.
/// On non-macOS platforms this is a no-op.
#[tauri::command]
fn update_dock_menu(app: tauri::AppHandle, recent_folders: Vec<String>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // Persist so we can restore on next launch.
        if let Ok(store) = app.store("store.json") {
            let _ = store.set("dock_recent_folders", serde_json::json!(recent_folders));
            let _ = store.save();
        }
        dock::rebuild(&app, &recent_folders);
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (app, recent_folders);
    Ok(())
}

// License commands
#[tauri::command]
async fn validate_license(key: String, org_id: String, _app_handle: tauri::AppHandle) -> Result<license_manager::LicenseStatus, String> {
    let status = license_manager::validate_license_key(&key, &org_id).await?;
    Ok(status) // Don't cache here, let activate handle caching
}

#[tauri::command]
async fn activate_license(key: String, org_id: String, app_handle: tauri::AppHandle) -> Result<license_manager::LicenseStatus, String> {
    // 1. Validate first (which checks limit)
    let mut status = license_manager::validate_license_key(&key, &org_id).await?;
    
    // 2. If valid, activate
    if status.is_valid {
        let activation_id = license_manager::activate_license_key(&key, &org_id).await?;
        status.activation_id = Some(activation_id);
        
        // Cache the result with the activation_id
        if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
            let _ = license_manager::cache_validation_result(&status, &app_data_dir);
        }
    }
    
    Ok(status)
}

#[tauri::command]
async fn remove_license_key(org_id: String, app: tauri::AppHandle) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
        
    // 1. Deactivate license if we have the key and activation_id
    if let Ok(status) = license_manager::get_license_status(&app_data_dir).await {
        if let Ok(Some(key)) = keychain::get_license_key() {
            if let Some(ref activation_id) = status.activation_id {
                let _ = license_manager::deactivate_license_key(&key, &org_id, activation_id).await;
            }
        }
    }

    // 2. Remove from keychain
    keychain::delete_license_key()?;
    
    // 3. remove cached validation
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    let cache_file = app_data_dir.join("license_cache.json");
    if cache_file.exists() {
        std::fs::remove_file(&cache_file)
            .map_err(|e| format!("Failed to remove cache file: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
async fn get_license_status(app_handle: tauri::AppHandle) -> Result<license_manager::LicenseStatus, String> {
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    license_manager::get_license_status(&app_data_dir).await
}

#[tauri::command]
fn save_license_key(key: String) -> Result<(), String> {
    keychain::save_license_key(&key)
}

#[tauri::command]
fn is_licensed(app_handle: tauri::AppHandle) -> Result<bool, String> {
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    license_manager::is_licensed(&app_data_dir)
}

#[tauri::command]
fn get_grace_period_info() -> Result<license_manager::GracePeriodInfo, String> {
    license_manager::get_grace_period_info()
}

#[tauri::command]
fn get_mcp_server_paths(app: tauri::AppHandle) -> Vec<String> {
    let mut candidates = Vec::new();

    // macOS specific candidates
    #[cfg(target_os = "macos")]
    {
        candidates.push("/Applications/Depdok.app/Contents/MacOS/depdok-mcp-server".to_string());
        if let Some(home) = std::env::var_os("HOME") {
            let home_path = std::path::PathBuf::from(home)
                .join("Applications")
                .join("Depdok.app")
                .join("Contents")
                .join("MacOS")
                .join("depdok-mcp-server");
            candidates.push(home_path.to_string_lossy().to_string());
        }
    }

    // Windows specific candidates
    #[cfg(target_os = "windows")]
    {
        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
            let path = std::path::PathBuf::from(local_app_data)
                .join("Programs")
                .join("Depdok")
                .join("depdok-mcp-server.exe");
            candidates.push(path.to_string_lossy().to_string());
        }
        if let Some(program_files) = std::env::var_os("ProgramFiles") {
            let path = std::path::PathBuf::from(program_files)
                .join("Depdok")
                .join("depdok-mcp-server.exe");
            candidates.push(path.to_string_lossy().to_string());
        }
    }

    // Resource directory candidate (both platforms)
    #[cfg(target_os = "windows")]
    let binary_name = "depdok-mcp-server.exe";
    #[cfg(not(target_os = "windows"))]
    let binary_name = "depdok-mcp-server";

    // In dev mode, check the target/debug and target/release directories as well
    #[cfg(debug_assertions)]
    {
        if let Ok(current_dir) = std::env::current_dir() {
            let debug_binary1 = current_dir.join("target").join("debug").join(binary_name);
            let debug_binary2 = current_dir.join("src-tauri").join("target").join("debug").join(binary_name);
            let release_binary1 = current_dir.join("target").join("release").join(binary_name);
            let release_binary2 = current_dir.join("src-tauri").join("target").join("release").join(binary_name);
            candidates.push(debug_binary1.to_string_lossy().to_string());
            candidates.push(debug_binary2.to_string_lossy().to_string());
            candidates.push(release_binary1.to_string_lossy().to_string());
            candidates.push(release_binary2.to_string_lossy().to_string());
        }
    }

    // Sibling of the current running executable
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let exe_dir_binary = exe_dir.join(binary_name);
            candidates.push(exe_dir_binary.to_string_lossy().to_string());
        }
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        let resource_binary = resource_dir.join(binary_name);
        candidates.push(resource_binary.to_string_lossy().to_string());
    }

    candidates
        .into_iter()
        .filter(|path| {
            let p = std::path::Path::new(path);
            p.exists() && p.metadata().map(|m| m.len() > 0).unwrap_or(false)
        })
        .collect()
}

#[tauri::command]
fn check_mcp_config_status(app: tauri::AppHandle, agent_id: String, workspace_root: Option<String>) -> bool {
    let home_dir = app.path().home_dir().ok();
    
    // Check helper
    let file_contains_depdok = |path: &std::path::Path| -> bool {
        if !path.exists() {
            return false;
        }
        if let Ok(content) = std::fs::read_to_string(path) {
            content.contains("depdok")
        } else {
            false
        }
    };

    match agent_id.as_str() {
        "claude" => {
            if let Some(home) = home_dir {
                #[cfg(target_os = "windows")]
                let path = app.path().app_config_dir().ok()
                    .map(|p| p.join("Claude/claude_desktop_config.json"))
                    .unwrap_or_else(|| home.join("AppData/Roaming/Claude/claude_desktop_config.json"));
                
                #[cfg(not(target_os = "windows"))]
                let path = home.join("Library/Application Support/Claude/claude_desktop_config.json");
                
                return file_contains_depdok(&path);
            }
            false
        }
        "claudecode" => {
            let mut configured = false;
            if let Some(ref home) = home_dir {
                let path = home.join(".claude.json");
                configured = configured || file_contains_depdok(&path);
            }
            if let Some(ref root) = workspace_root {
                let path = std::path::PathBuf::from(root).join(".mcp.json");
                configured = configured || file_contains_depdok(&path);
            }
            configured
        }
        "copilot" => {
            let mut configured = false;
            if let Some(ref home) = home_dir {
                let path = home.join(".copilot/mcp-config.json");
                configured = configured || file_contains_depdok(&path);
            }
            if let Some(ref root) = workspace_root {
                let path = std::path::PathBuf::from(root).join(".vscode/mcp.json");
                configured = configured || file_contains_depdok(&path);
            }
            configured
        }
        "gemini" => {
            let mut configured = false;
            if let Some(ref home) = home_dir {
                let path = home.join(".gemini/settings.json");
                configured = configured || file_contains_depdok(&path);
            }
            if let Some(ref root) = workspace_root {
                let path = std::path::PathBuf::from(root).join(".vscode/mcp.json");
                configured = configured || file_contains_depdok(&path);
            }
            configured
        }
        "codex" => {
            let mut configured = false;
            if let Some(ref root) = workspace_root {
                let path1 = std::path::PathBuf::from(root).join(".vscode/mcp.json");
                let path2 = std::path::PathBuf::from(root).join("codex-config.json");
                configured = configured || file_contains_depdok(&path1) || file_contains_depdok(&path2);
            }
            configured
        }
        "opencode" => {
            if let Some(ref root) = workspace_root {
                let path = std::path::PathBuf::from(root).join("opencode.jsonc");
                return file_contains_depdok(&path);
            }
            false
        }
        _ => false
    }
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env file (ignore errors if file doesn't exist)
    let _ = dotenvy::dotenv();
    
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            let base_dir = std::path::PathBuf::from(&cwd);
            let mut paths = Vec::new();
            for arg in argv.iter().skip(1) {
                if arg.starts_with('-') {
                    continue;
                }
                paths.push(resolve_and_normalize_path(&base_dir, arg));
            }
            if !paths.is_empty() {
                let _ = app.emit("open-paths", &paths);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            app.manage(knowledge_base::CurrentProjectGroup(Mutex::new(None)));

            let current_dir = std::env::current_dir().unwrap_or_default();
            let mut initial_paths = Vec::new();
            for arg in std::env::args().skip(1) {
                if arg.starts_with('-') {
                    continue;
                }
                initial_paths.push(resolve_and_normalize_path(&current_dir, &arg));
            }
            app.manage(PendingOpenPaths(Mutex::new(initial_paths)));

            // Initialize file watcher state
            app.manage(commands::file_watcher::init());
            
            // Initialize workspace watcher state
            app.manage(commands::file_watcher::WorkspaceWatcher::new());
            
            // Initialize Git watcher state
            app.manage(commands::git::GitWatcher::new());
            
            // Initialize file search state
            app.manage(commands::file_search::init());
            
            // Initialize content search state
            app.manage(commands::content_search::init());
            
            // Initialize logger server state
            app.manage(commands::logger::LoggerServerState::new());

            // Initialize terminal PTY state
            app.manage(Arc::new(commands::terminal::TerminalState::new()));

            // Initialize LLM state
            app.manage(llm::LlmState::new());

            // Initialize knowledge base (SQLite + embedding model)
            match knowledge_base::init_knowledge_base(app.handle()) {
                Ok((kb_state, embedder_state)) => {
                    app.manage(kb_state);
                    app.manage(embedder_state);
                    println!("[knowledge_base] initialized successfully");
                }
                Err(e) => {
                    eprintln!("[knowledge_base] init failed: {e}");
                }
            }
            
            // Load saved window size from store
            let store = app.store("store.json").expect("Failed to get store");
            
            let default_width = 740.0;
            let default_height = 850.0;
            
            let width = store.get("window_width")
                .and_then(|v| v.as_f64())
                .unwrap_or(default_width);
            
            let height = store.get("window_height")
                .and_then(|v| v.as_f64())
                .unwrap_or(default_height);
            
            #[cfg(debug_assertions)]
            println!("Loading window size: {}x{}", width, height);
            // Initialize menu
            menu::init(app)?;

            // Set up macOS dock menu (reads previous session's recent folders from store).
            #[cfg(target_os = "macos")]
            {
                dock::setup(app.handle());
                let initial_recent: Vec<String> = if let Ok(store) = app.store("store.json") {
                    store.get("dock_recent_folders")
                        .and_then(|v| serde_json::from_value(v).ok())
                        .unwrap_or_default()
                } else {
                    vec![]
                };
                dock::rebuild(app.handle(), &initial_recent);
            }

            let win_builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("Depdok")
                .inner_size(width, height)
                .min_inner_size(MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT)
                .decorations(false)
                .disable_drag_drop_handler(); // Disable Tauri's file drop to allow browser handling

            #[cfg(target_os = "windows")]
            let win_builder = win_builder
                .transparent(false)
                .background_color(tauri::window::Color(24, 24, 24, 255));

            #[cfg(not(target_os = "windows"))]
            let win_builder = win_builder.transparent(true);

            #[cfg(target_os = "macos")]
            let window = win_builder.build().unwrap();

            #[cfg(not(target_os = "macos"))]
            let _window = win_builder.build().unwrap();

            // set background color only when building for macOS
            #[cfg(target_os = "macos")]
            {
                use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

                // Apply blur effect with 10px rounded corners
                let blur = NSVisualEffectMaterial::HudWindow;
                // let blur = NSVisualEffectMaterial::FullScreenUI;

                // let blur = NSVisualEffectMaterial::Sidebar (Current, thick frosted glass)
                // let blur = NSVisualEffectMaterial::HudWindow (Darker, thinner)
                // let blur = NSVisualEffectMaterial::Menu (Thin, standard menu transparency)
                // let blur = NSVisualEffectMaterial::Popover (Similar to Menu)
                // let blur = NSVisualEffectMaterial::UnderWindowBackground (Standard window blur)
                // let blur = NSVisualEffectMaterial::UnderPageBackground (Subtle)
                // let blur = NSVisualEffectMaterial::FullScreenUI (Dark and thick)


                apply_vibrancy(&window, blur, None, Some(10.0))
                    .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");
            }

            // Register window resize handler to save size
            let window = app
                .get_webview_window("main")
                .expect("Failed to get main window");
            
            let app_handle = app.app_handle().clone();
            let window_clone = window.clone();
            window.on_window_event(
                move |event| {
                    match event {
                        tauri::WindowEvent::Resized(_) => {
                            // Get physical size and scale factor
                            if let (Ok(physical_size), Ok(scale_factor)) = (window_clone.inner_size(), window_clone.scale_factor()) {
                                // Convert physical pixels to logical pixels
                                let width = physical_size.width as f64 / scale_factor;
                                let height = physical_size.height as f64 / scale_factor;
                                
                                // #[cfg(debug_assertions)]
                                // println!("Window resized - Physical: {}x{}, Scale: {}, Logical: {}x{}", 
                                //     physical_size.width, physical_size.height, scale_factor, width, height);
                                
                                // Save logical window size to store
                                if let Ok(store) = app_handle.store("store.json") {
                                    let _ = store.set("window_width", serde_json::json!(width));
                                    let _ = store.set("window_height", serde_json::json!(height));
                                    let _ = store.save();
                                }
                            }
                        }
                        tauri::WindowEvent::CloseRequested { .. } => {}
                        _ => {}
                    }
                },
            );
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            check_context_menu_status,
            register_context_menu,
            unregister_context_menu,
            get_pending_open_paths,
            install_cli,
            uninstall_cli,
            get_cli_info,
            get_opened_file_path,
            toggle_devtools,
            open_devtools,
            close_devtools,
            commands::files::list_dir,
            commands::files::read_file_content,
            commands::files::write_file_content,
            commands::files::write_binary_file,
            commands::files::create_directory,
            commands::files::create_file,
            commands::files::delete_node,
            commands::files::rename_node,
            commands::files::copy_node,
            commands::files::reveal_file,
            commands::export::export_markdown_to_html,
            commands::export::export_markdown_to_pdf,
            commands::git::get_current_branch,
            commands::git::get_all_branches,
            commands::git::get_git_refs,
            commands::git::create_branch,
            commands::git::checkout_detached,
            commands::git::switch_branch,
            commands::git::get_git_status,
            commands::git::git_pull,
            commands::git::has_git_upstream,
            commands::git::get_git_sync_status,
            commands::git::start_watching_git,
            commands::git::stop_watching_git,
            commands::git::is_git_repository,
            commands::file_watcher::start_watching,
            commands::file_watcher::stop_watching,
            commands::file_watcher::start_watching_workspace,
            commands::file_watcher::stop_watching_workspace,
            commands::file_explorer::open_folder_dialog,
            commands::file_search::index_workspace_files,
            commands::file_search::fuzzy_search_files,
            commands::content_search::search_content,
            commands::content_search::set_content_search_workspace,
            open_new_window,
            update_dock_menu,
            // License commands
            validate_license,
            get_license_status,
            save_license_key,
            remove_license_key,
            is_licensed,
            get_grace_period_info,
            get_mcp_server_paths,
            check_mcp_config_status,
            activate_license,
            commands::logger::start_logger_server,
            commands::logger::register_logger_channel,
            commands::terminal::start_pty_session,
            commands::terminal::write_to_pty,
            commands::terminal::resize_pty,
            commands::terminal::close_pty_session,
            knowledge_base::commands::insert_or_replace_document,
            knowledge_base::commands::index_markdown_document_sections,
            knowledge_base::commands::delete_document,
            knowledge_base::commands::delete_connection,
            knowledge_base::commands::connect_to,
            knowledge_base::commands::search_similar,
            knowledge_base::commands::search_hybrid,
            knowledge_base::commands::get_chunk_context,
            knowledge_base::commands::get_document,
            knowledge_base::commands::get_project_graph,
            knowledge_base::commands::set_current_project_group,
            knowledge_base::commands::test_database_query,
            knowledge_base::commands::rebuild_all_edges,
            knowledge_base::commands::get_current_embedding_model,
            knowledge_base::commands::update_embedding_model_and_reindex,
            knowledge_base::commands::get_downloaded_models,
            knowledge_base::commands::reveal_cache_dir,
            knowledge_base::commands::get_model_download_size,
            knowledge_base::commands::get_cache_dir,
            knowledge_base::commands::download_embedding_model,
            knowledge_base::commands::delete_embedding_model,
            llm::settings::get_llm_config,
            llm::settings::save_llm_config,
            llm::settings::load_llm_provider,
            llm::settings::unload_llm_provider,
            llm::settings::get_llm_provider_status,
            llm::chat::send_chat_message,
            llm::chat::execute_llm_tool,
            llm::chat::cancel_generation,
            llm::chat::list_chat_sessions,
            llm::chat::load_chat_session,
            llm::chat::delete_chat_session,
            llm::settings::scan_local_llm_models,
            llm::settings::download_llm_model,
            llm::settings::delete_llm_model,
            llm::settings::reveal_llm_models_dir,
            llm::settings::get_llm_models_dir,
            llm::commands::grammar_correct_text,
            llm::commands::edit_text_with_ai,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                // Kill all open PTY sessions to prevent orphaned shell processes.
                if let Some(terminal_state) = app.try_state::<Arc<commands::terminal::TerminalState>>() {
                    terminal_state.kill_all();
                }
            }
        });
}
