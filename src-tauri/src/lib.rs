// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::sync::Mutex;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_store::StoreExt;

// Global state to store the opened file path
struct OpenedFilePath(Mutex<Option<String>>);

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

// License commands
#[tauri::command]
async fn validate_license(key: String, org_id: String, app_handle: tauri::AppHandle) -> Result<license_manager::LicenseStatus, String> {
    let status = license_manager::validate_license_key(&key, &org_id).await?;
    
    // Cache the result
    if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
        let _ = license_manager::cache_validation_result(&status, &app_data_dir);
    }
    
    Ok(status)
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
fn remove_license_key(app: tauri::AppHandle) -> Result<(), String> {
    // Remove from keychain
    keychain::delete_license_key()?;
    
    // Also remove cached validation
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
fn is_licensed(app_handle: tauri::AppHandle) -> Result<bool, String> {
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    license_manager::is_licensed(&app_data_dir)
}

#[tauri::command]
fn get_grace_period_info() -> Result<license_manager::GracePeriodInfo, String> {
    license_manager::get_grace_period_info()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            // Initialize file watcher state
            app.manage(commands::file_watcher::init());
            
            // Initialize file search state
            app.manage(commands::file_search::init());
            
            // Initialize content search state
            app.manage(commands::content_search::init());
            
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

            let win_builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("Depdok")
                .inner_size(width, height)
                .decorations(false)
                .transparent(true)
                .disable_drag_drop_handler(); // Disable Tauri's file drop to allow browser handling



            let window = win_builder.build().unwrap();

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
            commands::git::get_current_branch,
            commands::git::get_all_branches,
            commands::git::switch_branch,
            commands::git::get_git_status,
            commands::git::git_pull,
            commands::file_watcher::start_watching,
            commands::file_watcher::stop_watching,
            commands::file_explorer::open_folder_dialog,
            commands::file_search::index_workspace_files,
            commands::file_search::fuzzy_search_files,
            commands::content_search::search_content,
            commands::content_search::set_content_search_workspace,
            // License commands
            validate_license,
            get_license_status,
            save_license_key,
            remove_license_key,
            is_licensed,
            get_grace_period_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
