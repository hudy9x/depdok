use std::sync::{Arc, Mutex};
use ignore::WalkBuilder;
use nucleo_matcher::{Matcher, Config};
use serde::{Serialize, Deserialize};
use tauri::State;

#[derive(Default)]
pub struct FileSearchState {
    workspace_path: Option<String>,
    indexed_files: Vec<String>,
}

pub type FileSearchStateHandle = Arc<Mutex<FileSearchState>>;

pub fn init() -> FileSearchStateHandle {
    Arc::new(Mutex::new(FileSearchState::default()))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SearchResult {
    path: String,
    score: i32,
    match_indices: Vec<u32>,
}

#[tauri::command]
pub fn index_workspace_files(
    workspace_path: String,
    state: State<FileSearchStateHandle>,
) -> Result<usize, String> {
    let mut indexed_files = Vec::new();
    
    // Use WalkBuilder to traverse directory
    let walker = WalkBuilder::new(&workspace_path)
        .hidden(false)  // Include hidden files
        .git_ignore(true)  // Respect .gitignore
        .git_exclude(true)  // Respect .git/info/exclude
        .build();
    
    for result in walker {
        match result {
            Ok(entry) => {
                // Only index files, not directories
                if let Some(file_type) = entry.file_type() {
                    if file_type.is_file() {
                        if let Ok(relative_path) = entry.path().strip_prefix(&workspace_path) {
                            // Convert to string and use forward slashes for consistency
                            let path_str = relative_path.to_string_lossy()
                                .replace('\\', "/");
                            indexed_files.push(path_str);
                        }
                    }
                }
            }
            Err(err) => {
                eprintln!("Error walking directory: {}", err);
            }
        }
    }
    
    let count = indexed_files.len();
    
    // Update state
    let mut state_guard = state.lock().map_err(|e| e.to_string())?;
    state_guard.workspace_path = Some(workspace_path);
    state_guard.indexed_files = indexed_files;
    
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
    
    let indexed_files = &state_guard.indexed_files;
    let limit = limit.unwrap_or(50);
    
    // Create matcher with default config
    let mut matcher = Matcher::new(Config::DEFAULT);
    let mut results = Vec::new();
    
    // Convert query to Utf32String for nucleo-matcher (this is the needle - what we search for)
    let needle = nucleo_matcher::Utf32String::from(query.as_str());
    
    // Search through all indexed files
    for file_path in indexed_files {
        let mut indices = Vec::new();
        
        // Convert file path to Utf32String (this is the haystack - what we search in)
        let haystack = nucleo_matcher::Utf32String::from(file_path.as_str());
        
        // Perform fuzzy match: fuzzy_indices(haystack, needle, indices)
        // Use .slice() to convert Utf32String to Utf32Str
        if let Some(score) = matcher.fuzzy_indices(haystack.slice(..), needle.slice(..), &mut indices) {
            results.push(SearchResult {
                path: file_path.clone(),
                score: score as i32,  // Convert u16 to i32
                match_indices: indices,
            });
        }
    }
    
    // Sort by score (descending - higher is better)
    results.sort_by(|a, b| b.score.cmp(&a.score));
    
    // Limit results
    results.truncate(limit);
    
    Ok(results)
}
