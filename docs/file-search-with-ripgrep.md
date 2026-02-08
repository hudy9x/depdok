# File Search in Folder with Ripgrep in Tauri

A step-by-step guide to implement fuzzy file search across workspace folders in Tauri applications.

## Overview

This guide shows how to build a VSCode-like file search feature using:
- **nucleo-matcher**: High-performance fuzzy matching (6x faster than alternatives)
- **ignore**: File traversal that respects `.gitignore` patterns
- **Tauri**: Rust backend with TypeScript frontend

## Step 1: Add Rust Dependencies

Add to `src-tauri/Cargo.toml`:

```toml
[dependencies]
nucleo-matcher = "0.3"
ignore = "0.4"
```

## Step 2: Create File Search Module

Create `src-tauri/src/commands/file_search.rs`:

```rust
use std::sync::{Arc, Mutex};
use ignore::WalkBuilder;
use nucleo_matcher::{Matcher, Config};
use serde::Serialize;
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

#[derive(Serialize)]
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
    
    let walker = WalkBuilder::new(&workspace_path)
        .hidden(false)
        .git_ignore(true)
        .build();
    
    for result in walker {
        if let Ok(entry) = result {
            if let Some(file_type) = entry.file_type() {
                if file_type.is_file() {
                    if let Ok(relative_path) = entry.path().strip_prefix(&workspace_path) {
                        indexed_files.push(relative_path.to_string_lossy().replace('\\', "/"));
                    }
                }
            }
        }
    }
    
    let count = indexed_files.len();
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
    
    let mut matcher = Matcher::new(Config::DEFAULT);
    let mut results = Vec::new();
    let needle = nucleo_matcher::Utf32String::from(query.as_str());
    
    for file_path in &state_guard.indexed_files {
        let mut indices = Vec::new();
        let haystack = nucleo_matcher::Utf32String::from(file_path.as_str());
        
        if let Some(score) = matcher.fuzzy_indices(haystack.slice(..), needle.slice(..), &mut indices) {
            results.push(SearchResult {
                path: file_path.clone(),
                score: score as i32,
                match_indices: indices,
            });
        }
    }
    
    results.sort_by(|a, b| b.score.cmp(&a.score));
    results.truncate(limit.unwrap_or(50));
    
    Ok(results)
}
```

## Step 3: Register Commands

Update `src-tauri/src/commands/mod.rs`:

```rust
pub mod file_search;
```

Update `src-tauri/src/lib.rs`:

```rust
.setup(|app| {
    app.manage(commands::file_search::init());
    // ... other setup
})
.invoke_handler(tauri::generate_handler![
    commands::file_search::index_workspace_files,
    commands::file_search::fuzzy_search_files,
    // ... other commands
])
```

## Step 4: Create Frontend API Client

Create `src/features/FileSearchDialog/api.ts`:

```typescript
import { invoke } from '@tauri-apps/api/core';

export interface SearchResult {
  path: string;
  score: number;
  match_indices: number[];
}

export async function indexWorkspaceFiles(workspacePath: string): Promise<number> {
  return await invoke('index_workspace_files', { workspacePath });
}

export async function fuzzySearchFiles(query: string, limit?: number): Promise<SearchResult[]> {
  return await invoke('fuzzy_search_files', { query, limit });
}
```

## Step 5: Implement Search UI

Update your search component:

```typescript
import { useState, useEffect } from "react";
import { fuzzySearchFiles, SearchResult } from "./api";

export function FileSearchDialog() {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (!searchQuery) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      const searchResults = await fuzzySearchFiles(searchQuery, 50);
      setResults(searchResults);
    }, 300); // Debounce 300ms

    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div>
      <input 
        value={searchQuery} 
        onChange={(e) => setSearchQuery(e.target.value)} 
        placeholder="Search files..."
      />
      {results.map((result, idx) => (
        <div key={idx}>{result.path}</div>
      ))}
    </div>
  );
}
```

## Step 6: Trigger Indexing

Index files when workspace opens:

```typescript
import { indexWorkspaceFiles } from '@/features/FileSearchDialog/api';

async function openWorkspace(path: string) {
  // ... load workspace
  
  try {
    await indexWorkspaceFiles(path);
    console.log('Workspace indexed');
  } catch (error) {
    console.error('Indexing failed:', error);
  }
}
```

## Key Concepts

### Fuzzy Matching
- **Needle**: What you search FOR (the query)
- **Haystack**: What you search IN (file paths)
- Uses Smith-Waterman algorithm for accurate matching

### Performance
- Indexes files once on workspace open
- Searches happen in-memory (very fast)
- Limits results to top 50 by score
- Debounces user input (300ms)

### File Traversal
- Uses `ignore` crate (respects `.gitignore`)
- Includes hidden files
- Excludes `.git/` directory automatically
- Returns relative paths for portability

## Common Patterns

**Search with custom limit:**
```typescript
const results = await fuzzySearchFiles("query", 100);
```

**Re-index on workspace change:**
```typescript
await indexWorkspaceFiles(newWorkspacePath);
```

**Combine with other results:**
```typescript
const allResults = [...openTabs, ...workspaceResults];
```

## Troubleshooting

**Empty results**: Ensure workspace is indexed first
**Slow search**: Check if indexing completed successfully
**Wrong paths**: Verify workspace path is absolute

## References

- [nucleo-matcher](https://crates.io/crates/nucleo-matcher)
- [ignore crate](https://crates.io/crates/ignore)
- [Tauri Commands](https://tauri.app/develop/calling-rust/)
