use notify_debouncer_full::{new_debouncer, notify::{EventKind, RecursiveMode}, DebounceEventResult};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

// Global state to hold the current watched file path
pub struct FileWatcher {
    pub current_path: Arc<Mutex<Option<String>>>,
}

impl FileWatcher {
    pub fn new() -> Self {
        Self {
            current_path: Arc::new(Mutex::new(None)),
        }
    }
}

#[tauri::command]
pub fn start_watching(path: String, app: AppHandle) -> Result<(), String> {
    // Validate that the path exists
    if !PathBuf::from(&path).exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let state = app.state::<FileWatcher>();
    
    // Update the current watched path
    {
        let mut current = state.current_path.lock().map_err(|e| e.to_string())?;
        *current = Some(path.clone());
    }

    #[cfg(debug_assertions)]
    println!("Started watching: {}", path);

    // Spawn a new task to handle file watching
    let watch_path = path.clone();
    let app_handle = app.clone();
    let current_path_ref = state.current_path.clone();

    std::thread::spawn(move || {
        let result = (|| -> Result<(), String> {
            let app_clone = app_handle.clone();
            let watch_path_clone = watch_path.clone();
            let current_path_clone = current_path_ref.clone();

            let mut debouncer = new_debouncer(
                Duration::from_millis(500),
                None,
                move |result: DebounceEventResult| {
                    match result {
                        Ok(events) => {
                            for event in events {
                                // Check if this is a relevant event (Modify, Create, or Remove)
                                if matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_)) {
                                    for event_path in &event.paths {
                                        // Check if this path matches our currently watched file
                                        let current_watched = current_path_clone.lock().ok()
                                            .and_then(|guard| guard.clone());
                                        
                                        if let Some(watched) = current_watched {
                                            if event_path.to_string_lossy() == watched {
                                                #[cfg(debug_assertions)]
                                                println!("File changed: {}", watched);
                                                
                                                // Emit event to frontend
                                                let _ = app_clone.emit("file-changed", watched.clone());
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        Err(_errors) => {
                            #[cfg(debug_assertions)]
                            eprintln!("Watch error: {:?}", _errors);
                        }
                    }
                },
            ).map_err(|e| e.to_string())?;

            // Watch the file - in version 0.7.0, call watch directly on debouncer
            debouncer
                .watch(PathBuf::from(&watch_path_clone).as_path(), RecursiveMode::NonRecursive)
                .map_err(|e| e.to_string())?;

            // Keep the debouncer alive
            // This thread will run until the app exits or the path changes
            loop {
                std::thread::sleep(Duration::from_secs(1));
                
                // Check if we should stop watching this file
                let current = current_path_ref.lock().ok()
                    .and_then(|guard| guard.clone());
                
                if current.as_ref() != Some(&watch_path_clone) {
                    #[cfg(debug_assertions)]
                    println!("Stopping watcher for: {}", watch_path_clone);
                    break;
                }
            }

            Ok(())
        })();

        if let Err(e) = result {
            eprintln!("File watcher error: {}", e);
        }
    });

    Ok(())
}

#[tauri::command]
pub fn stop_watching(app: AppHandle) -> Result<(), String> {
    let state = app.state::<FileWatcher>();
    
    let mut current = state.current_path.lock().map_err(|e| e.to_string())?;
    
    if let Some(_path) = current.take() {
        #[cfg(debug_assertions)]
        println!("Stopped watching: {}", _path);
    }
    
    Ok(())
}

// Initialize the file watcher state
pub fn init() -> FileWatcher {
    FileWatcher::new()
}
