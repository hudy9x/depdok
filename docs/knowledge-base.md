# Knowledge Base — Implementation Plan

## Goal

Implement a local, offline-first knowledge base and knowledge graph for a desktop markdown note application.  
Storage: local SQLite via `rusqlite` + `sqlite-vec` for vector search.  
Embeddings: generated on the Rust/backend side behind a **provider-agnostic `Embedder` trait** so the active backend can be swapped without touching commands or DB logic.  
Default provider: `fastembed` (local ONNX, `all-MiniLM-L6-v2`, fully offline).  
Future provider: OpenAI `text-embedding-3-large` (opt-in, requires API key).

---

## 1. Dependencies (`Cargo.toml`)

Add the following crates:

- `rusqlite` with the `"bundled"` feature (statically compiles SQLite — no system SQLite required)
- `sqlite-vec` for the `vec0` virtual table extension
- `fastembed` — local ONNX embeddings (`all-MiniLM-L6-v2`, 384 dims, ~22 MB). Model is downloaded once on first run and cached; fully offline after that.
- `reqwest` with `"json"` + `"blocking"` features — **optional**, only needed for the OpenAI provider. Gate behind a Cargo feature flag `openai-embeddings` so it is not compiled in by default.
- `uuid` with the `"v4"` feature for generating document IDs
- `serde` / `serde_json` (likely already present via Tauri) for serialising OpenAI request/response

---

## 2. Module Structure

Place all knowledge-base code under `src-tauri/src/knowledge_base/` as a Rust submodule:

```
src-tauri/src/knowledge_base/
├── mod.rs                  # Re-exports; exposes init_knowledge_base() and state types
├── db.rs                   # DB init, schema creation, managed-state setup
├── commands.rs             # All #[tauri::command] functions
└── embedding/
    ├── mod.rs              # Embedder trait + EmbedderState type + init helper
    ├── chunker.rs          # Text splitting logic (chunk size, overlap)
    ├── fastembed.rs        # Local fastembed provider (default)
    └── openai.rs           # OpenAI provider (compiled only with feature "openai-embeddings")
```

Register the module in `lib.rs` and add all commands to the `invoke_handler`.

---

## 3. State Management

Use Tauri's managed state to hold a single, shared `rusqlite::Connection` wrapped in a `Mutex`:

```rust
pub struct KbState(pub Mutex<Connection>);
```

Registered at startup via `app.manage(KbState(...))`.  
Every command receives `State<'_, KbState>` instead of re-opening the DB per call.

Wrap the active embedder provider in managed state using a **trait object** so the concrete type is hidden from commands:

```rust
// embedding/mod.rs
pub struct EmbedderState(pub Mutex<Box<dyn Embedder>>);
```

The concrete provider (`FastEmbedProvider` or `OpenAiProvider`) is chosen at startup and stored as `Box<dyn Embedder>`. Commands never depend on the concrete type.

Both states are initialised inside Tauri's `.setup()` closure.

---

## 4. Database Initialization (`db.rs`)

Function signature:
```rust
pub fn init_database(app_handle: &tauri::AppHandle) -> Result<Connection, String>
```

Steps:
1. Resolve the OS app-data directory via `app_handle.path().app_data_dir()`.
2. Call `sqlite3_auto_extension` to register the `sqlite-vec` extension before opening the connection.
3. Open the SQLite connection.
4. Enable `PRAGMA foreign_keys = ON` so cascading deletes on `edges` work.
5. Create the schema (idempotent `CREATE TABLE IF NOT EXISTS` / `CREATE VIRTUAL TABLE IF NOT EXISTS`).

### Schema

```sql
-- Plain document store
CREATE TABLE IF NOT EXISTS documents (
    id      TEXT PRIMARY KEY,   -- UUID v4
    title   TEXT NOT NULL,
    content TEXT NOT NULL
);

-- Knowledge graph edges
CREATE TABLE IF NOT EXISTS edges (
    id        TEXT PRIMARY KEY,  -- UUID v4
    source_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    type      TEXT               -- optional label, e.g. "related", "parent"
);

-- Vector chunks (sqlite-vec virtual table)
-- The dimension count (e.g. 384 or 3072) is read from the active Embedder at init time
-- and interpolated into this statement by db.rs at runtime.
CREATE VIRTUAL TABLE IF NOT EXISTS documents_embeddings USING vec0(
    chunk_id    TEXT PRIMARY KEY,
    document_id TEXT,
    embedding   FLOAT[{dimensions}]  -- filled in from Embedder::dimensions()
);
```

> Note: `vec0` does not natively support foreign keys, so `delete_document` must manually delete associated rows from `documents_embeddings` before (or after) deleting from `documents`.

---

## 5. Embedding Subsystem (`embedding/`)

### 5a. `Embedder` trait (`embedding/mod.rs`)

Defines the provider-agnostic interface:

```rust
pub trait Embedder: Send + Sync {
    /// Embed a single piece of text and return a float vector.
    fn embed(&self, text: &str) -> Result<Vec<f32>, String>;
    /// Number of dimensions this provider produces.
    fn dimensions(&self) -> usize;
    /// Human-readable provider name (for logging/UI).
    fn name(&self) -> &'static str;
}
```

Also exposes the init helper that selects the provider based on runtime config:

```rust
pub fn init_embedder(/* config/settings */) -> Result<Box<dyn Embedder>, String>
```

For now this always returns `FastEmbedProvider`. When `openai-embeddings` feature is enabled and an API key is configured, it returns `OpenAiProvider` instead.

---

### 5b. Text chunker (`embedding/chunker.rs`)

Responsible for splitting long documents into overlapping chunks before embedding.

```rust
pub struct ChunkOptions {
    pub max_chars: usize,    // e.g. 512
    pub overlap_chars: usize // e.g. 64
}

pub fn chunk_text(text: &str, opts: &ChunkOptions) -> Vec<String>
```

- Splits on sentence/paragraph boundaries where possible; falls back to hard character split.
- Returns a `Vec<String>` of chunks. Each chunk is embedded independently.
- A chunk's `chunk_id` is formatted as `"{document_id}#{index}"` (e.g. `"uuid-abc#0"`, `"uuid-abc#1"`).

---

### 5c. Local provider (`embedding/fastembed.rs`)

```rust
pub struct FastEmbedProvider { /* holds TextEmbedding */ }

impl FastEmbedProvider {
    pub fn new() -> Result<Self, String> { ... }
}

impl Embedder for FastEmbedProvider {
    fn embed(&self, text: &str) -> Result<Vec<f32>, String> { ... }
    fn dimensions(&self) -> usize { 384 }
    fn name(&self) -> &'static str { "fastembed/all-MiniLM-L6-v2" }
}
```

- Loads `all-MiniLM-L6-v2` via `fastembed::TextEmbedding::try_new(InitOptions::default())`.
- Model (~22 MB ONNX) is downloaded once to the OS cache dir; fully offline after that.
- Multi-chunk input: call `model.embed(chunks, None)` then average the resulting vectors into one.

---

### 5d. OpenAI provider (`embedding/openai.rs`)

> Compiled only when Cargo feature `openai-embeddings` is enabled.

```rust
#[cfg(feature = "openai-embeddings")]
pub struct OpenAiProvider {
    api_key: String,
    model: String,   // e.g. "text-embedding-3-large"
    dimensions: usize, // 3072 for text-embedding-3-large
}

#[cfg(feature = "openai-embeddings")]
impl Embedder for OpenAiProvider {
    fn embed(&self, text: &str) -> Result<Vec<f32>, String> { ... }
    fn dimensions(&self) -> usize { self.dimensions }
    fn name(&self) -> &'static str { "openai/text-embedding-3-large" }
}
```

- Makes a `POST https://api.openai.com/v1/embeddings` call via `reqwest`.
- API key is read from app settings (never hard-coded).
- **Dimension note**: `text-embedding-3-large` produces 3072 dims by default. The `documents_embeddings` virtual table schema must match the active provider's `dimensions()` at init time. `db.rs` reads this value from the selected `Embedder` before creating the table.

---

## 6. Tauri Commands (`commands.rs`)

All commands are `async`, accept `tauri::State`, and return `Result<T, String>`.

### `insert_or_replace_document`
```
insert_or_replace_document(state, embedder_state, id: Option<String>, title: String, content: String) -> Result<String, String>
```
- If `id` is `None`, generate a new UUID v4.
- `INSERT OR REPLACE INTO documents`.
- Split `content` into chunks via `chunker::chunk_text()` using default `ChunkOptions`.
- Embed each chunk using `embedder_state` (calls `Embedder::embed()` on the active provider).
- Delete any existing rows for this `document_id` in `documents_embeddings`, then insert the new chunk rows (`chunk_id = "{doc_id}#{i}"`).
- Return the document `id`.

### `delete_document`
```
delete_document(state, id: String) -> Result<(), String>
```
- Delete matching rows from `documents_embeddings` first (manual cascade since `vec0` doesn't support FK).
- Then `DELETE FROM documents WHERE id = ?` — this cascades to `edges` automatically via FK.

### `connect_to`
```
connect_to(state, source_id: String, target_id: String, edge_type: Option<String>) -> Result<String, String>
```
- `INSERT INTO edges` with a freshly generated UUID.
- Return the new edge `id`.

### `search_similar`
```
search_similar(state, embedder_state, query: String, limit: usize) -> Result<Vec<SearchResult>, String>
```
- Embed `query` using `embedder_state`.
- Run `SELECT chunk_id, document_id, distance FROM documents_embeddings WHERE embedding MATCH ? ORDER BY distance LIMIT ?` using `sqlite-vec` KNN syntax.
- Join with `documents` to return `id`, `title`, and `distance` for each result.
- `SearchResult` is a serialisable struct: `{ id: String, title: String, distance: f32 }`.

### `get_document`
```
get_document(state, id: String) -> Result<Option<DocumentRecord>, String>
```
- `SELECT id, title, content FROM documents WHERE id = ?`.
- Returns `None` if not found.
- `DocumentRecord`: `{ id: String, title: String, content: String }`.

---

## 7. Error Handling Rules

- Map all `rusqlite::Error` and `fastembed` errors to `String` via `.map_err(|e| e.to_string())`.
- Never panic inside a command; always return `Err(...)`.
- Embedding failures should not silently skip — surface the error to the frontend.

---

## 8. Constraints

- No external network calls at runtime (model download on first launch is acceptable and must be documented in the UI).
- No cloud APIs or remote vector stores.
- All data lives in `{app_data_dir}/knowledge_base.db`.