use notify_debouncer_full::{
    new_debouncer,
    notify::{EventKind, RecursiveMode},
    DebounceEventResult, Debouncer, RecommendedCache,
};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

// ---------------------------------------------------------------------------
// Existing single-file watcher (kept intact — used by useFileWatcher hook)
// ---------------------------------------------------------------------------

use std::collections::HashSet;

pub struct FileWatcher {
    pub current_path: Arc<Mutex<Option<String>>>,
    pub ignored_paths: Arc<Mutex<HashSet<String>>>,
}

impl FileWatcher {
    pub fn new() -> Self {
        Self {
            current_path: Arc::new(Mutex::new(None)),
            ignored_paths: Arc::new(Mutex::new(HashSet::new())),
        }
    }

    pub fn ignore_path(&self, path: String) {
        if let Ok(mut ignored) = self.ignored_paths.lock() {
            ignored.insert(path);
        }
    }

    pub fn is_ignored(&self, path: &str) -> bool {
        if let Ok(ignored) = self.ignored_paths.lock() {
            ignored.contains(path)
        } else {
            false
        }
    }
}

#[tauri::command]
pub fn start_watching(path: String, app: AppHandle) -> Result<(), String> {
    if !PathBuf::from(&path).exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let state = app.state::<FileWatcher>();

    {
        let mut current = state.current_path.lock().map_err(|e| e.to_string())?;
        *current = Some(path.clone());
    }

    #[cfg(debug_assertions)]
    println!("Started watching: {}", path);

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
                                if matches!(
                                    event.kind,
                                    EventKind::Modify(_)
                                        | EventKind::Create(_)
                                        | EventKind::Remove(_)
                                ) {
                                    for event_path in &event.paths {
                                        let current_watched = current_path_clone
                                            .lock()
                                            .ok()
                                            .and_then(|guard| guard.clone());

                                        if let Some(watched) = current_watched {
                                            if event_path.to_string_lossy() == watched {
                                                let watcher_state = app_clone.state::<FileWatcher>();
                                                if watcher_state.is_ignored(&watched) {
                                                    #[cfg(debug_assertions)]
                                                    println!("[FileWatcher] Ignoring file change event for: {}", watched);
                                                    continue;
                                                }

                                                #[cfg(debug_assertions)]
                                                println!("File changed: {}", watched);
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
            )
            .map_err(|e| e.to_string())?;

            debouncer
                .watch(
                    PathBuf::from(&watch_path_clone).as_path(),
                    RecursiveMode::NonRecursive,
                )
                .map_err(|e| e.to_string())?;

            loop {
                std::thread::sleep(Duration::from_secs(1));
                let current = current_path_ref
                    .lock()
                    .ok()
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

pub fn init() -> FileWatcher {
    FileWatcher::new()
}

// ---------------------------------------------------------------------------
// Workspace watcher — watches an entire workspace directory
// ---------------------------------------------------------------------------

#[derive(Clone, serde::Serialize, serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub enum ChangeKind {
    Created,
    Modified,
    Removed,
    Renamed,
}

#[derive(Clone, serde::Serialize, serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceChangeEvent {
    pub kind: ChangeKind,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from_path: Option<String>,
}

fn normalize_path_str(path: &Path) -> String {
    let s = path.to_string_lossy().to_string();
    #[cfg(target_os = "windows")]
    {
        s.replace('/', "\\")
    }
    #[cfg(not(target_os = "windows"))]
    {
        s
    }
}

/// Holds an active debounced workspace watcher.
/// Wrapped in Mutex<Option<...>> so we can drop (stop) and replace it safely.
pub struct WorkspaceWatcher {
    inner: Mutex<Option<Debouncer<notify_debouncer_full::notify::RecommendedWatcher, RecommendedCache>>>,
}

impl WorkspaceWatcher {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }
}

/// Start watching the workspace root recursively, skipping ignored directories.
/// Any previously active workspace watcher is stopped first.
#[tauri::command]
pub fn start_watching_workspace(workspace_root: String, app: AppHandle) -> Result<(), String> {
    let root_path = PathBuf::from(&workspace_root);
    if !root_path.exists() {
        return Err(format!("Workspace root does not exist: {}", workspace_root));
    }

    let state = app.state::<WorkspaceWatcher>();

    // Drop existing watcher before creating a new one (stops threads + descriptors).
    {
        let mut guard = state.inner.lock().map_err(|e| e.to_string())?;
        *guard = None;
    }

    #[cfg(debug_assertions)]
    println!("[WorkspaceWatcher] Starting watch on: {}", workspace_root);

    let app_clone = app.clone();

    let mut debouncer = new_debouncer(
        Duration::from_millis(500),
        None,
        move |result: DebounceEventResult| {
            match result {
                Ok(events) => {
                    #[cfg(debug_assertions)]
                    println!("[WorkspaceWatcher] 📬 Received raw notify event batch of size: {}", events.len());

                    let mut batch: Vec<WorkspaceChangeEvent> = Vec::new();

                    for event in &events {
                        #[cfg(debug_assertions)]
                        println!("[WorkspaceWatcher] 🔍 Raw notify event: {:?}", event);

                        match &event.kind {
                            EventKind::Create(_) => {
                                for p in &event.paths {
                                    batch.push(WorkspaceChangeEvent {
                                        kind: ChangeKind::Created,
                                        path: normalize_path_str(p),
                                        from_path: None,
                                    });
                                }
                            }
                            EventKind::Modify(notify_debouncer_full::notify::event::ModifyKind::Name(
                                notify_debouncer_full::notify::event::RenameMode::Both,
                            )) => {
                                // notify-debouncer-full coalesces rename pairs into a single event
                                // with paths[0] = from, paths[1] = to
                                if event.paths.len() >= 2 {
                                    batch.push(WorkspaceChangeEvent {
                                        kind: ChangeKind::Renamed,
                                        path: normalize_path_str(&event.paths[1]),
                                        from_path: Some(normalize_path_str(&event.paths[0])),
                                    });
                                } else {
                                    // Partial rename info — treat as remove + create
                                    for p in &event.paths {
                                        batch.push(WorkspaceChangeEvent {
                                            kind: ChangeKind::Modified,
                                            path: normalize_path_str(p),
                                            from_path: None,
                                        });
                                    }
                                }
                            }
                            EventKind::Modify(_) => {
                                for p in &event.paths {
                                    batch.push(WorkspaceChangeEvent {
                                        kind: ChangeKind::Modified,
                                        path: normalize_path_str(p),
                                        from_path: None,
                                    });
                                }
                            }
                            EventKind::Remove(_) => {
                                for p in &event.paths {
                                    batch.push(WorkspaceChangeEvent {
                                        kind: ChangeKind::Removed,
                                        path: normalize_path_str(p),
                                        from_path: None,
                                    });
                                }
                            }
                            _ => {}
                        }
                    }

                    if !batch.is_empty() {
                        #[cfg(debug_assertions)]
                        println!("[WorkspaceWatcher] 📢 Emitting {} events to frontend: {:?}", batch.len(), batch);
                        let _ = app_clone.emit("workspace-changed", batch);
                    }
                }
                Err(errors) => {
                    eprintln!("[WorkspaceWatcher] ❌ Watch error: {:?}", errors);
                }
            }
        },
    )
    .map_err(|e| e.to_string())?;

    // Register watch on the root recursively.
    // notify's recursive mode handles subdirectories; we rely on our frontend
    // ignore-list filtering to avoid reacting to events from ignored dirs.
    // On platforms where recursive watch is expensive, we could switch to
    // manual per-dir registration, but for now recursive is simplest.
    debouncer
        .watch(&root_path, RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    // Store the debouncer so it stays alive.
    {
        let mut guard = state.inner.lock().map_err(|e| e.to_string())?;
        *guard = Some(debouncer);
    }

    #[cfg(debug_assertions)]
    println!("[WorkspaceWatcher] Watch registered on: {}", workspace_root);

    Ok(())
}

/// Stop the active workspace watcher (drops the debouncer thread and OS handles).
#[tauri::command]
pub fn stop_watching_workspace(app: AppHandle) -> Result<(), String> {
    let state = app.state::<WorkspaceWatcher>();
    let mut guard = state.inner.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        *guard = None;
        #[cfg(debug_assertions)]
        println!("[WorkspaceWatcher] Stopped");
    }
    Ok(())
}
