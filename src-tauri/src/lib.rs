// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::sync::Mutex;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder, Emitter};
use tauri::menu::{MenuBuilder, SubmenuBuilder};
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
            // Create menu
            let new_file_submenu = SubmenuBuilder::new(app, "New file")
                .text("new_file_md", "Markdown")
                .text("new_file_mmd", "Mermaid")
                .text("new_file_todo", "Todo")
                .text("new_file_pu", "PlantUML")
                .text("new_file_txt", "Text")
                .build()?;
            
            let file_submenu = SubmenuBuilder::new(app, "File")
                .item(&new_file_submenu)
                .text("open_file", "Open File")
                .separator()
                .text("back", "Back")
                .separator()
                .text("quit", "Quit")
                .build()?;
            
            let menu = MenuBuilder::new(app)
                .item(&file_submenu)
                .build()?;
            
            app.set_menu(menu)?;
            
            // Handle menu events
            app.on_menu_event(move |app_handle, event| {
                match event.id().0.as_str() {
                    "new_file_md" => {
                        let _ = app_handle.emit("menu://new-file-md", ());
                    }
                    "new_file_mmd" => {
                        let _ = app_handle.emit("menu://new-file-mmd", ());
                    }
                    "new_file_todo" => {
                        let _ = app_handle.emit("menu://new-file-todo", ());
                    }
                    "new_file_pu" => {
                        let _ = app_handle.emit("menu://new-file-pu", ());
                    }
                    "new_file_txt" => {
                        let _ = app_handle.emit("menu://new-file-txt", ());
                    }
                    "open_file" => {
                        // Emit event to frontend
                        let _ = app_handle.emit("menu://open-file", ());
                    }
                    "back" => {
                        let _ = app_handle.emit("menu://back", ());
                    }
                    "quit" => {
                        app_handle.exit(0);
                    }
                    _ => {}
                }
            });

            let win_builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("Transparent Titlebar Window")
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
            commands::git::get_current_branch,
            commands::git::get_all_branches,
            commands::git::switch_branch,
            commands::git::get_git_status,
            commands::git::git_pull,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
