use std::sync::{Arc, Mutex};
use ignore::WalkBuilder;
use nucleo_matcher::{Matcher, Config};
use serde::{Serialize, Deserialize};
use tauri::State;

#[derive(Clone, Debug)]
pub struct IndexedEntry {
    pub path: String,
    pub is_dir: bool,
}

#[derive(Default)]
pub struct FileSearchState {
    workspace_path: Option<String>,
    indexed_entries: Vec<IndexedEntry>,
}

pub type FileSearchStateHandle = Arc<Mutex<FileSearchState>>;

pub fn init() -> FileSearchStateHandle {
    Arc::new(Mutex::new(FileSearchState::default()))
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SearchResult {
    pub path: String,
    pub score: i32,
    pub match_indices: Vec<u32>,
    #[serde(default)]
    pub is_dir: bool,
}

#[tauri::command]
pub fn index_workspace_files(
    workspace_path: String,
    state: State<FileSearchStateHandle>,
) -> Result<usize, String> {
    let start_time = std::time::Instant::now();
    println!("[PERF RUST] index_workspace_files starting for: {}", workspace_path);
    let mut indexed_entries = Vec::new();
    
    // Use WalkBuilder to traverse directory
    let walker = WalkBuilder::new(&workspace_path)
        .hidden(false)  // Include hidden files
        .git_ignore(true)  // Respect .gitignore
        .git_exclude(true)  // Respect .git/info/exclude
        .build();
    
    for result in walker {
        match result {
            Ok(entry) => {
                if let Some(file_type) = entry.file_type() {
                    // Index both files and directories, excluding the workspace root itself
                    if let Ok(relative_path) = entry.path().strip_prefix(&workspace_path) {
                        let path_str = relative_path.to_string_lossy()
                            .replace('\\', "/");
                        if !path_str.is_empty() {
                            indexed_entries.push(IndexedEntry {
                                path: path_str,
                                is_dir: file_type.is_dir(),
                            });
                        }
                    }
                }
            }
            Err(err) => {
                eprintln!("Error walking directory: {}", err);
            }
        }
    }
    
    let count = indexed_entries.len();
    println!("[PERF RUST] index_workspace_files completed: indexed {} entries in {:?}", count, start_time.elapsed());
    
    // Update state
    let mut state_guard = state.lock().map_err(|e| e.to_string())?;
    state_guard.workspace_path = Some(workspace_path);
    state_guard.indexed_entries = indexed_entries;
    
    Ok(count)
}

#[tauri::command]
pub fn fuzzy_search_files(
    query: String,
    limit: Option<usize>,
    state: State<FileSearchStateHandle>,
) -> Result<Vec<SearchResult>, String> {
    let state_guard = state.lock().map_err(|e| e.to_string())?;
    
    if query.is_empty() {
        return Ok(Vec::new());
    }
    
    let indexed_entries = &state_guard.indexed_entries;
    let limit = limit.unwrap_or(50);
    
    // Create matcher with default config
    let mut matcher = Matcher::new(Config::DEFAULT);
    let mut results = Vec::new();
    
    // Convert query to Utf32String for nucleo-matcher (this is the needle - what we search for)
    let needle = nucleo_matcher::Utf32String::from(query.as_str());
    
    // Search through all indexed entries
    for entry in indexed_entries {
        let mut indices = Vec::new();
        
        // Convert path to Utf32String (this is the haystack - what we search in)
        let haystack = nucleo_matcher::Utf32String::from(entry.path.as_str());
        
        // Perform fuzzy match: fuzzy_indices(haystack, needle, indices)
        if let Some(score) = matcher.fuzzy_indices(haystack.slice(..), needle.slice(..), &mut indices) {
            let mut final_score = score as i32;
            let file_name = entry.path.split('/').last().unwrap_or(&entry.path);
            let lower_needle = query.to_lowercase();
            let lower_name = file_name.to_lowercase();
            let lower_path = entry.path.to_lowercase();
            let name_without_ext = lower_name.rsplit_once('.').map(|(stem, _)| stem).unwrap_or(&lower_name);

            // Exact match on filename, stem, or full path
            if lower_name == lower_needle || name_without_ext == lower_needle || lower_path == lower_needle {
                final_score += 20000;
            } else if lower_name.starts_with(&lower_needle) || name_without_ext.starts_with(&lower_needle) {
                final_score += 10000;
            } else if lower_path.starts_with(&lower_needle) {
                final_score += 5000;
            } else if lower_name.contains(&lower_needle) {
                final_score += 2000;
            }

            results.push(SearchResult {
                path: entry.path.clone(),
                score: final_score,
                match_indices: indices,
                is_dir: entry.is_dir,
            });
        }
    }
    
    // Sort by score (descending - higher is better)
    results.sort_by(|a, b| b.score.cmp(&a.score));
    
    // Limit results
    results.truncate(limit);
    
    Ok(results)
}
