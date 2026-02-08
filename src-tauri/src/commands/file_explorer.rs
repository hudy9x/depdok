use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn open_folder_dialog(app: AppHandle) -> Result<Option<String>, String> {
    let folder_path = app.dialog()
        .file()
        .blocking_pick_folder();
    
    match folder_path {
        Some(path) => {
            let path_str = path.as_path().unwrap().to_string_lossy().to_string();
            Ok(Some(path_str))
        },
        None => Ok(None),
    }
}
