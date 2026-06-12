# Code Structure Recommendations for an MCP & AI Agent-First Knowledge Base

Since the primary consumer of this offline-first knowledge base is an **AI Agent via the Model Context Protocol (MCP)** rather than a human user navigating a GUI, the architecture needs to prioritize **token efficiency, metadata-rich context retrieval, hybrid query precision, and strict decoupling**.

Here are the recommended code structure improvements designed for agent-centric ingestion.

---

## 1. Decoupled Core Architecture (`KbManager`)

Currently, Tauri commands in `commands.rs` and the MCP server in `mcp_server/mod.rs` independently call loose helper functions (`upsert_document_internal`, etc.) and lock resources individually. 

To make the system robust and easily extensible for the agent, we should wrap the database connection and active embedder into a unified, thread-safe manager struct:

```rust
// In knowledge_base/mod.rs or a new manager.rs
use std::sync::Arc;
use tokio::sync::RwLock;
use rusqlite::Connection;
use crate::knowledge_base::embedding::Embedder;

#[derive(Clone)]
pub struct KbManager {
    db: Arc<tokio::sync::Mutex<Connection>>,
    embedder: Arc<RwLock<Box<dyn Embedder>>>,
}

impl KbManager {
    pub fn new(db_path: &Path, cache_dir: Option<PathBuf>) -> Result<Self, String> { ... }
    
    pub async fn search_similar(&self, query: &str, limit: usize) -> Result<Vec<SearchResult>, String> { ... }
    pub async fn upsert_document(&self, doc: DocumentInput) -> Result<String, String> { ... }
    // ...
}
```

### Benefits for MCP:
*   **Decoupled State:** Tauri's `app.manage(KbState(...))` will simply wrap `app.manage(KbManager::new(...))`. The MCP server initialization in `mcp_server/mod.rs` can instantiate the exact same `KbManager` without referencing Tauri-specific types.
*   **Concurrency Safety:** Moving to async-first methods on `KbManager` prevents blocking operations, which is crucial when the MCP server handles multiple tool calls or background indexing concurrent with agent queries.

---

## 2. Agent-First Metadata & "Context Window" Expansion

When an AI agent searches a vector DB, it often receives a isolated text fragment (a chunk) and loses the surrounding context (e.g. the file path, parent heading, or code block imports). We should structure database records and search queries to return **context-augmented chunks**.

### Proposed Database Schema Enhancements
Add `parent_heading` and `relative_hierarchy` metadata to chunks so the agent knows the structural context:

```sql
CREATE TABLE chunks (
    id          INTEGER PRIMARY KEY,
    document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    parent_heading TEXT,              -- E.g. "### 2. Database design"
    hierarchy   TEXT NOT NULL,        -- JSON array of parent headers: ["Backend Rust", "Database design"]
    embedding   BLOB NOT NULL
);
```

### Exposing context expansion tools to MCP:
An agent needs to be able to "look around" a vector search hit. We should add a specific tool: `kb_get_chunk_context`:

```rust
// Exposes the target chunk plus N preceding and succeeding chunks in the same file.
pub fn get_chunk_with_context(
    &self,
    document_id: &str,
    target_index: usize,
    surrounding_window: usize,
) -> Result<String, String> {
    // SQL: SELECT content FROM chunks 
    //      WHERE document_id = ?1 
    //      AND chunk_index BETWEEN (target_index - window) AND (target_index + window)
    //      ORDER BY chunk_index ASC
}
```

This allows the agent to dynamically fetch surrounding content ONLY when a vector search match is promising, avoiding excessive token consumption on the initial search response.

---

## 3. Hybrid Search Integration (FTS5 + Vector MATCH)

AI Agents are highly efficient at semantic matching, but fail when searching for exact coding identifiers (such as function names like `init_knowledge_base`, exact parameter keys, or variable signatures). 

To solve this, we should combine SQLite's FTS5 virtual table with `sqlite-vec`.

### Recommended Folder and Search Structure

```text
src-tauri/src/knowledge_base/
├── mod.rs                # Entrypoint, KbManager definition
├── db.rs                 # Schema migration + auto-extension loading
├── commands.rs           # Thin Tauri command wrappers
├── search/               # Dedicated search sub-module
│   ├── mod.rs
│   ├── fts.rs            # Keyword matches using MATCH against FTS5 virtual tables
│   ├── vector.rs         # KNN vector queries against vec0 table
│   └── hybrid.rs         # Reciprocal Rank Fusion (RRF) to merge BM25 and Vector scores
```

### The Hybrid Search Logic
An agent calling `kb_search` should hit `hybrid.rs` which performs both queries and merges them:

```rust
pub async fn search_hybrid(&self, query: &str, limit: usize) -> Result<Vec<SearchResult>, String> {
    // 1. Run FTS5 keyword query -> yields list of (document_id, fts_rank)
    // 2. Run KNN vector query -> yields list of (document_id, vector_distance)
    // 3. Apply Reciprocal Rank Fusion (RRF) to re-rank documents
    // 4. Return the top N documents containing the merged score, indicating if it was a keyword or semantic hit
}
```

---

## 4. Automatic AST/Graph Linkage for Codebases

Since the agent is using the knowledge base to inspect code or markdown structures, we can utilize `pulldown-cmark` and AST parsers to auto-link documents.

Instead of manual connections via `connect_to`, the chunking pipeline should automatically extract structural references and populate `edges`:

```rust
// parser/links.rs
pub struct ExtractedMetadata {
    pub tags: Vec<String>,
    pub wikilinks: Vec<String>,
    pub code_references: Vec<String>, // E.g., parsing `use crate::module::symbol` or code symbols
}

pub fn extract_metadata(markdown: &str) -> ExtractedMetadata {
    // Implement pulldown-cmark parser loops to gather links, tags, and inline backticks
}
```

When the `KbManager` indexes a file, it parses the metadata, updates the `tags` table, and automatically inserts rows into the `edges` table. This allows the AI agent to ask: *"What files reference the symbol `KbState`?"* and traverse the graph programmatically.

---

## 5. Summary of Recommended Directory Layout

Refined layout to cleanly accommodate the MCP server and separate retrieval logic:

```text
src-tauri/src/knowledge_base/
├── mod.rs                  # Exposes KbManager & init states
├── manager.rs              # Arc-based KbManager implementing core orchestrations
├── db.rs                   # SQL schema definition & migrations
├── commands.rs             # Thin Tauri wrappers calling KbManager
│
├── parser/                 # Decoupled Markdown parsing & chunking
│   ├── mod.rs
│   ├── markdown.rs         # pulldown-cmark metadata extractor (tags, links)
│   └── chunker.rs          # Section-aware token/character splitter
│
├── search/                 # Advanced query execution
│   ├── mod.rs
│   ├── fts.rs              # SQLite FTS5 search wrapper
│   ├── vector.rs           # sqlite-vec KNN MATCH queries
│   └── hybrid.rs           # Reciprocal Rank Fusion (RRF) combiner
│
├── embedding/              # Vector providers
│   ├── mod.rs              # Async-trait Embedder interface
│   ├── fastembed.rs        # Local ONNX provider
│   └── openai.rs           # Async HTTP OpenAI provider (non-blocking)
```
