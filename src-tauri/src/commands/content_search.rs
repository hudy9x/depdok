use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use grep_regex::RegexMatcher;
use grep_searcher::{Searcher, SearcherBuilder, Sink, SinkMatch};
use ignore::WalkBuilder;
use serde::{Serialize, Deserialize};
use tauri::State;

#[derive(Default)]
pub struct ContentSearchState {
    workspace_path: Option<String>,
}

pub type ContentSearchStateHandle = Arc<Mutex<ContentSearchState>>;

pub fn init() -> ContentSearchStateHandle {
    Arc::new(Mutex::new(ContentSearchState::default()))
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ContentSearchResult {
    file_path: String,
    line_number: u64,
    line_content: String,
    match_start: usize,
    match_end: usize,
}

#[derive(Deserialize)]
pub struct SearchOptions {
    #[serde(default)]
    _case_sensitive: bool,
    #[serde(default = "default_max_results")]
    max_results: usize,
}

fn default_max_results() -> usize {
    500
}

struct ResultCollector {
    results: Vec<ContentSearchResult>,
    max_results: usize,
    _workspace_path: PathBuf,
}

impl ResultCollector {
    fn new(max_results: usize, workspace_path: PathBuf) -> Self {
        Self {
            results: Vec::new(),
            max_results,
            _workspace_path: workspace_path,
        }
    }
}

impl Sink for ResultCollector {
    type Error = std::io::Error;

    fn matched(&mut self, _searcher: &Searcher, mat: &SinkMatch<'_>) -> Result<bool, Self::Error> {
        if self.results.len() >= self.max_results {
            return Ok(false); // Stop searching when we hit the limit
        }

        let line_number = mat.line_number().unwrap_or(0);
        let line_content = String::from_utf8_lossy(mat.bytes()).to_string();
        
        // Get the first match position in the line
        let (match_start, match_end) = if let Some(_first_match) = mat.bytes()
            .windows(mat.bytes().len())
            .enumerate()
            .find(|(_, _)| true)
        {
            // For simplicity, we'll mark the entire matched portion
            // In a more sophisticated implementation, we'd extract exact match positions
            (0, line_content.len())
        } else {
            (0, 0)
        };

        self.results.push(ContentSearchResult {
            file_path: String::new(), // Will be set by the caller
            line_number,
            line_content: line_content.trim_end().to_string(),
            match_start,
            match_end,
        });

        Ok(true) // Continue searching
    }
}

#[tauri::command]
pub fn search_content(
    query: String,
    options: Option<SearchOptions>,
    state: State<ContentSearchStateHandle>,
) -> Result<Vec<ContentSearchResult>, String> {
    let state_guard = state.lock().map_err(|e| e.to_string())?;
    
    let workspace_path = state_guard
        .workspace_path
        .as_ref()
        .ok_or("No workspace path set")?;
    
    println!("[ContentSearch] Workspace path: {}", workspace_path);
    
    if query.is_empty() {
        println!("[ContentSearch] Empty query, returning no results");
        return Ok(Vec::new());
    }
    
    println!("[ContentSearch] Searching for: '{}'", query);
    
    let options = options.unwrap_or(SearchOptions {
        _case_sensitive: false,
        max_results: 500,
    });
    
    println!("[ContentSearch] Max results: {}", options.max_results);
    
    // Create regex matcher
    let matcher = RegexMatcher::new_line_matcher(&query)
        .map_err(|e| format!("Invalid regex pattern: {}", e))?;
    
    let mut all_results = Vec::new();
    let workspace_root = PathBuf::from(workspace_path);
    
    println!("[ContentSearch] Starting file walk...");
    
    // Walk through files in workspace
    let walker = WalkBuilder::new(&workspace_root)
        .hidden(false)
        .git_ignore(true)
        .git_exclude(true)
        .filter_entry(|entry| {
            // Exclude .git directory
            if let Some(file_name) = entry.file_name().to_str() {
                file_name != ".git"
            } else {
                true
            }
        })
        .build();
    
    let mut files_searched = 0;
    
    for entry in walker {
        if all_results.len() >= options.max_results {
            println!("[ContentSearch] Reached max results limit");
            break;
        }
        
        match entry {
            Ok(entry) => {
                if let Some(file_type) = entry.file_type() {
                    if file_type.is_file() {
                        let path = entry.path();
                        files_searched += 1;
                        
                        // Create searcher
                        let mut searcher = SearcherBuilder::new()
                            .line_number(true)
                            .build();
                        
                        // Create collector for this file
                        let mut collector = ResultCollector::new(
                            options.max_results - all_results.len(),
                            workspace_root.clone(),
                        );
                        
                        // Search the file
                        if let Err(e) = searcher.search_path(&matcher, path, &mut collector) {
                            eprintln!("Error searching file {:?}: {}", path, e);
                            continue;
                        }
                        
                        // Add relative path to results
                        if let Ok(relative_path) = path.strip_prefix(&workspace_root) {
                            let path_str = relative_path.to_string_lossy().replace('\\', "/");
                            if !collector.results.is_empty() {
                                println!("[ContentSearch] Found {} matches in: {}", collector.results.len(), path_str);
                            }
                            for result in &mut collector.results {
                                result.file_path = path_str.clone();
                            }
                            all_results.extend(collector.results);
                        }
                    }
                }
            }
            Err(err) => {
                eprintln!("Error walking directory: {}", err);
            }
        }
    }
    
    println!("[ContentSearch] Searched {} files, found {} total results", files_searched, all_results.len());
    
    Ok(all_results)
}

#[tauri::command]
pub fn set_content_search_workspace(
    workspace_path: String,
    state: State<ContentSearchStateHandle>,
) -> Result<(), String> {
    let mut state_guard = state.lock().map_err(|e| e.to_string())?;
    state_guard.workspace_path = Some(workspace_path);
    Ok(())
}
