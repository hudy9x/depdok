# Backend Rust — implementation plan

## 1. Crates

### Core crates and why

| Crate | Version | Why |
|---|---|---|
| `rusqlite` | 0.32 | SQLite bindings with `bundled` feature — no system SQLite required, single binary ships everything |
| `ort` | 2 | ONNX Runtime bindings — runs local embedding models (MiniLM, BGE, Nomic) fully offline |
| `tokenizers` | 0.21 | HuggingFace tokenizers — WordPiece/BPE tokenization matching exactly what each model expects |
| `reqwest` | 0.12 | HTTP client for OpenAI embedding API, feature `json` for automatic serde handling |
| `pulldown-cmark` | 0.12 | CommonMark parser — extracts `[[wikilinks]]`, `#tags`, headings, and plain text chunks in one pass |
| `notify` | 6 | Cross-platform file system watcher — fires events on `.md` file create/modify/delete |
| `async-trait` | 0.1 | Allows `async fn` inside the `Embedder` trait — required because Rust traits don't natively support async |
| `serde` + `serde_json` | 1 | Serialise DB rows and config structs to JSON for Tauri IPC |
| `keyring` | 2 | Stores OpenAI API key in the OS keychain (Keychain on macOS, Credential Manager on Windows, libsecret on Linux) — never in plaintext |
| `anyhow` + `thiserror` | 1 | `anyhow` for application-level error propagation, `thiserror` for typed domain errors on module boundaries |
| `walkdir` | 2 | Recursive folder traversal on startup to find all `.md` files and compare mtime against the DB |
| `slugify` | 0.1 | Converts `My Note Title.md` → `my-note-title` for stable note IDs |
| `dirs` | 5 | Resolves `~/.cache/huggingface/hub` and other platform paths for HuggingFace cache probing |

### Why `ort` over `candle`

`candle` is pure Rust but requires manually implementing mean pooling and model-specific pre/post-processing per architecture. `ort` loads any ONNX export unchanged — every sentence-transformer model on HuggingFace already has an `onnx/model.onnx` export ready to use. Switching models costs zero code changes.

---

## 2. Database design

All tables live in a single `app.db` SQLite file in the Tauri app data directory.

### Schema

```sql
-- Core content
CREATE TABLE notes (
    id          TEXT PRIMARY KEY,        -- slug from filename, e.g. "rust-ownership"
    path        TEXT NOT NULL UNIQUE,    -- absolute path on disk
    title       TEXT,                    -- first H1 heading, or filename if none
    content     TEXT NOT NULL,           -- raw markdown source
    mtime       INTEGER NOT NULL,        -- unix timestamp — used to skip unchanged files
    indexed_at  INTEGER NOT NULL         -- when the last index run completed
);

-- Text segments with embedding vectors
CREATE TABLE chunks (
    id          INTEGER PRIMARY KEY,
    note_id     TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,           -- plain text of the segment
    chunk_index INTEGER NOT NULL,        -- order within the note (0-based)
    embedding   BLOB NOT NULL,           -- f32[N] stored as little-endian bytes
    model_id    TEXT NOT NULL            -- which model produced this vector
);

-- Hashtags extracted from note content
CREATE TABLE tags (
    note_id     TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag         TEXT NOT NULL,
    PRIMARY KEY (note_id, tag)
);

-- Explicit links the user wrote ([[wikilinks]] and [label](path))
CREATE TABLE links (
    source_id   TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    target_id   TEXT NOT NULL,           -- may point to a note that does not exist yet
    PRIMARY KEY (source_id, target_id)
);

-- Automatic links computed by cosine similarity
CREATE TABLE semantic_links (
    source_id   TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    target_id   TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    score       REAL NOT NULL,           -- cosine similarity, 0.0–1.0
    model_id    TEXT NOT NULL,           -- invalidated and wiped when model changes
    PRIMARY KEY (source_id, target_id)
);

-- FTS5 virtual table — mode 1: content table, no duplicate text stored
CREATE VIRTUAL TABLE notes_fts USING fts5(
    title,
    content,
    content=notes,
    content_rowid=rowid
);

-- Sync triggers — Rust never writes to notes_fts directly
CREATE TRIGGER notes_fts_insert AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts (rowid, title, content)
    VALUES (new.rowid, new.title, new.content);
END;

CREATE TRIGGER notes_fts_update AFTER UPDATE ON notes BEGIN
    INSERT INTO notes_fts (notes_fts, rowid, title, content)
    VALUES ('delete', old.rowid, old.title, old.content);
    INSERT INTO notes_fts (rowid, title, content)
    VALUES (new.rowid, new.title, new.content);
END;

CREATE TRIGGER notes_fts_delete AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts (notes_fts, rowid, title, content)
    VALUES ('delete', old.rowid, old.title, old.content);
END;

-- Active embedder configuration — always exactly one row (id = 1)
CREATE TABLE embedder_config (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    model_type      TEXT NOT NULL DEFAULT 'local',
    model_id        TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2',
    dimensions      INTEGER NOT NULL DEFAULT 384,
    openai_model    TEXT,                -- non-null only when model_type = 'openai'
    openai_base_url TEXT                 -- optional override for Azure or local proxy
);

-- Per-model custom folder paths chosen by the user
CREATE TABLE model_paths (
    model_id    TEXT PRIMARY KEY,
    path        TEXT NOT NULL,           -- absolute folder path on disk
    verified_at INTEGER NOT NULL         -- unix timestamp of last successful load
);

-- Indexes
CREATE INDEX idx_chunks_note    ON chunks(note_id);
CREATE INDEX idx_chunks_model   ON chunks(model_id);
CREATE INDEX idx_semlinks_src   ON semantic_links(source_id);
CREATE INDEX idx_semlinks_tgt   ON semantic_links(target_id);
CREATE INDEX idx_semlinks_score ON semantic_links(score DESC);
CREATE INDEX idx_links_target   ON links(target_id);
CREATE INDEX idx_tags_tag       ON tags(tag);
CREATE INDEX idx_tags_note      ON tags(note_id);
```

### Table purposes

| Table | Purpose |
|---|---|
| `notes` | Single source of truth for every `.md` file. `mtime` is the key for incremental indexing — skip the file if mtime matches. |
| `chunks` | Stores both the text segment and its embedding vector. Wiped and rebuilt whenever the note changes or the model switches. |
| `tags` | Extracted `#tags` per note. Wiped and rebuilt on every save. Used for graph node colouring and filter UI. |
| `links` | Explicit connections the user wrote. Only the `source_id` side is wiped on save — other notes' links to this note are untouched. |
| `semantic_links` | Auto-computed connections. Both `source_id` and `target_id` sides are wiped on save because content changes can shift similarity in both directions. Entirely wiped on model switch. |
| `notes_fts` | FTS5 virtual table in content mode — stores only the search index, no duplicate text. Synced by triggers automatically. |
| `embedder_config` | Singleton row tracking which model is active. Always insert with `id = 1`; update in place when switching. |
| `model_paths` | Stores user-chosen folder locations per model ID. Consulted before falling back to the default app data directory. |

### Migration strategy

Use `include_str!` to embed `.sql` files at compile time and `PRAGMA user_version` to track which migrations have run:

```rust
// db/schema.rs
const MIGRATION_001: &str = include_str!("migrations/001_initial.sql");

pub fn run_migrations(conn: &Connection) -> anyhow::Result<()> {
    let version: i32 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;

    if version < 1 {
        conn.execute_batch(MIGRATION_001)?;
        conn.execute_batch("PRAGMA user_version = 1")?;
    }

    // populate FTS for any notes that predate trigger creation
    conn.execute_batch("
        INSERT INTO notes_fts (rowid, title, content)
        SELECT rowid, title, content FROM notes
        WHERE rowid NOT IN (SELECT rowid FROM notes_fts);
    ")?;

    Ok(())
}
```

---

## 3. Folder structure

```
src-tauri/src/
├── main.rs                        entry point, Tauri builder, command registration
├── state.rs                       AppState struct — holds db, embedder, config handles
│
├── db/
│   ├── mod.rs
│   ├── schema.rs                  run_migrations(), PRAGMA user_version logic
│   ├── queries/
│   │   ├── mod.rs
│   │   ├── notes.rs               CRUD for notes table
│   │   ├── chunks.rs              insert/delete/fetch chunks + embeddings
│   │   ├── links.rs               insert/delete explicit links, backlinks query
│   │   ├── semantic.rs            insert/delete/query semantic_links
│   │   ├── tags.rs                insert/delete/query tags
│   │   └── search.rs              FTS5 MATCH queries + snippet()
│   └── migrations/
│       ├── 001_initial.sql        all CREATE TABLE, triggers, indexes
│       └── 002_model_paths.sql    model_paths table (added later)
│
├── fs/
│   ├── mod.rs
│   ├── watcher.rs                 notify watcher — emits events into indexing pipeline
│   └── reader.rs                  read/write raw .md files from disk
│
├── parser/
│   ├── mod.rs
│   ├── markdown.rs                pulldown-cmark pass — extracts headings, plain text
│   ├── links.rs                   detects [[wikilinks]], [label](path), #tags
│   └── chunker.rs                 heading-aware split + 256-token sliding window
│
├── embedding/
│   ├── mod.rs                     Embedder trait definition
│   ├── local.rs                   LocalEmbedder — ort session + tokenizer
│   ├── openai.rs                  OpenAIEmbedder — reqwest HTTP calls
│   ├── model_path.rs              path resolution: custom → default → error
│   └── factory.rs                 build_embedder(config) → Box<dyn Embedder>
│
├── indexing/
│   ├── mod.rs
│   └── pipeline.rs                orchestrates steps 1–4 for a single note
│
├── graph/
│   ├── mod.rs
│   └── builder.rs                 reads notes + links + semantic_links → JSON for Sigma
│
└── config/
    ├── mod.rs
    ├── embedder_config.rs         load/save embedder_config table row
    └── model_paths.rs             load/save model_paths table, HF cache probe
```

### Why this structure

- `db/queries/` splits SQL by domain rather than putting all queries in one file. Each file maps to one table group — easy to find, easy to test in isolation.
- `parser/` is completely decoupled from `embedding/`. The chunker produces `Vec<String>` and knows nothing about vectors. The embedder knows nothing about markdown. This makes it straightforward to swap either side independently.
- `embedding/factory.rs` is the only file that knows all embedder variants exist. Everything else in the app holds a `Box<dyn Embedder>` and calls `embed_document()` or `embed_query()` — no match arms scattered across the codebase.
- `indexing/pipeline.rs` owns the full sequence (read → parse → embed → store → compute semantic links) in one place. Triggered by both the file watcher and the Tauri commands.
- `config/` is separate from `db/` because config concerns cross-cut the app — model paths are needed by the embedder before the indexing pipeline even starts.

---

## 4. Dynamic embedding models

### The Embedder trait

```rust
// embedding/mod.rs
use async_trait::async_trait;

#[async_trait]
pub trait Embedder: Send + Sync {
    /// Embed a document chunk stored in the DB.
    async fn embed_document(&self, text: &str) -> anyhow::Result<Vec<f32>>;

    /// Embed a search query. BGE models need a prefix here; others do not.
    async fn embed_query(&self, text: &str) -> anyhow::Result<Vec<f32>>;

    fn dimensions(&self) -> usize;
    fn model_id(&self) -> &str;
}
```

Two methods (`embed_document` vs `embed_query`) are needed because BGE models expect a prefix string on queries but not on documents. `all-MiniLM` and Nomic implement both identically — just call the same inner function.

### Local embedder (ONNX)

```rust
// embedding/local.rs
use ort::Session;
use tokenizers::Tokenizer;

pub struct LocalEmbedder {
    session:    Session,
    tokenizer:  Tokenizer,
    dimensions: usize,
    id:         String,
    query_prefix: Option<String>,   // Some("Represent...") for BGE, None otherwise
}

impl LocalEmbedder {
    pub fn new(files: ModelFiles, meta: ModelMeta) -> anyhow::Result<Self> {
        let session   = Session::builder()?.commit_from_file(&files.onnx_path)?;
        let tokenizer = Tokenizer::from_file(&files.tokenizer_path)
            .map_err(|e| anyhow::anyhow!(e))?;
        Ok(Self {
            session,
            tokenizer,
            dimensions: meta.dimensions,
            id: meta.model_id,
            query_prefix: meta.query_prefix,
        })
    }

    fn run(&self, text: &str) -> anyhow::Result<Vec<f32>> {
        let encoding = self.tokenizer.encode(text, true)
            .map_err(|e| anyhow::anyhow!(e))?;

        // build input tensors: input_ids, attention_mask, token_type_ids
        // forward pass through ONNX session
        // mean pool over token dimension
        // L2 normalise
        // return Vec<f32> of length self.dimensions
        todo!("ort forward pass + mean pool + L2 norm")
    }
}

#[async_trait]
impl Embedder for LocalEmbedder {
    async fn embed_document(&self, text: &str) -> anyhow::Result<Vec<f32>> {
        self.run(text)
    }

    async fn embed_query(&self, text: &str) -> anyhow::Result<Vec<f32>> {
        match &self.query_prefix {
            Some(prefix) => self.run(&format!("{prefix}: {text}")),
            None         => self.run(text),
        }
    }

    fn dimensions(&self) -> usize { self.dimensions }
    fn model_id(&self)   -> &str  { &self.id }
}
```

### OpenAI embedder

```rust
// embedding/openai.rs
pub struct OpenAIEmbedder {
    client:   reqwest::Client,
    api_key:  String,
    model:    String,
    base_url: String,
    dims:     usize,
}

#[async_trait]
impl Embedder for OpenAIEmbedder {
    async fn embed_document(&self, text: &str) -> anyhow::Result<Vec<f32>> {
        self.call_api(text).await
    }
    async fn embed_query(&self, text: &str) -> anyhow::Result<Vec<f32>> {
        self.call_api(text).await     // OpenAI handles query vs doc internally
    }
    fn dimensions(&self) -> usize { self.dims }
    fn model_id(&self)   -> &str  { &self.model }
}
```

### Factory

```rust
// embedding/factory.rs
pub fn build_embedder(
    config:      &EmbedderConfig,
    model_paths: &ModelPaths,
    app:         &tauri::AppHandle,
) -> anyhow::Result<Box<dyn Embedder>> {
    match config.model_type.as_str() {
        "local" => {
            let files = resolve_model_path(&config.model_id, model_paths, app)?;
            let meta  = model_meta(&config.model_id);
            Ok(Box::new(LocalEmbedder::new(files, meta)?))
        }
        "openai" => {
            let api_key = keyring::Entry::new("note-app", "openai-api-key")?
                .get_password()?;
            Ok(Box::new(OpenAIEmbedder::new(api_key, config)?))
        }
        other => anyhow::bail!("Unknown model type: {other}"),
    }
}
```

### Model metadata table

Rather than hardcoding per-model details across the codebase, keep them in one place:

```rust
// embedding/factory.rs
pub struct ModelMeta {
    pub model_id:     String,
    pub dimensions:   usize,
    pub query_prefix: Option<String>,
    pub hf_repo:      &'static str,
}

pub fn model_meta(model_id: &str) -> ModelMeta {
    match model_id {
        "all-MiniLM-L6-v2"        => ModelMeta { dimensions: 384,  query_prefix: None, hf_repo: "sentence-transformers/all-MiniLM-L6-v2" },
        "all-MiniLM-L12-v2"       => ModelMeta { dimensions: 384,  query_prefix: None, hf_repo: "sentence-transformers/all-MiniLM-L12-v2" },
        "bge-small-en-v1.5"       => ModelMeta { dimensions: 384,  query_prefix: Some("Represent this sentence for searching relevant passages".into()), hf_repo: "BAAI/bge-small-en-v1.5" },
        "bge-base-en-v1.5"        => ModelMeta { dimensions: 768,  query_prefix: Some("Represent this sentence for searching relevant passages".into()), hf_repo: "BAAI/bge-base-en-v1.5" },
        "nomic-embed-text-v1.5"   => ModelMeta { dimensions: 768,  query_prefix: None, hf_repo: "nomic-ai/nomic-embed-text-v1.5" },
        "multilingual-e5-small"   => ModelMeta { dimensions: 384,  query_prefix: None, hf_repo: "intfloat/multilingual-e5-small" },
        "multilingual-e5-base"    => ModelMeta { dimensions: 384,  query_prefix: None, hf_repo: "intfloat/multilingual-e5-base" },
        other => panic!("Unknown model id: {other}"),
    }
}
```

---

## 5. Custom model folder + default fallback

### Path resolution order

When the app needs to load a model it checks three locations in order:

```
1. model_paths table  →  user picked a custom folder via file picker
2. <app_data>/models/<model_id>/  →  downloaded by the app itself
3. ~/.cache/huggingface/hub/models--<org>--<name>/snapshots/<hash>/
      →  already on disk from Python / huggingface-cli
4. None found  →  return error, prompt user to download or pick
```

```rust
// embedding/model_path.rs

pub struct ModelFiles {
    pub onnx_path:      PathBuf,
    pub tokenizer_path: PathBuf,
}

pub fn resolve_model_path(
    model_id:    &str,
    model_paths: &ModelPaths,
    app:         &tauri::AppHandle,
) -> anyhow::Result<ModelFiles> {
    // 1. custom path saved by user
    if let Some(custom) = model_paths.get(model_id) {
        return probe_model_files(custom);
    }

    // 2. default app data dir
    let default_dir = app.path().app_data_dir()?.join("models").join(model_id);
    if default_dir.exists() {
        return probe_model_files(&default_dir);
    }

    // 3. HuggingFace local cache
    let meta = model_meta(model_id);
    if let Some(hf_path) = probe_hf_cache(meta.hf_repo) {
        return probe_model_files(&hf_path);
    }

    anyhow::bail!(
        "Model '{model_id}' not found. \
         Download it or select its folder in Settings → Embedding model."
    )
}

fn probe_model_files(base: impl AsRef<std::path::Path>) -> anyhow::Result<ModelFiles> {
    let base = base.as_ref();
    let onnx = [base.join("onnx/model.onnx"), base.join("model.onnx")]
        .into_iter()
        .find(|p| p.exists())
        .ok_or_else(|| anyhow::anyhow!("model.onnx not found in {}", base.display()))?;

    let tokenizer = base.join("tokenizer.json");
    anyhow::ensure!(tokenizer.exists(), "tokenizer.json not found in {}", base.display());

    Ok(ModelFiles { onnx_path: onnx, tokenizer_path: tokenizer })
}

fn probe_hf_cache(hf_repo: &str) -> Option<PathBuf> {
    // "BAAI/bge-small-en-v1.5" → "models--BAAI--bge-small-en-v1.5"
    let dir_name = format!("models--{}", hf_repo.replace('/', "--"));
    let cache    = dirs::home_dir()?.join(".cache/huggingface/hub").join(dir_name);
    if !cache.exists() { return None; }

    std::fs::read_dir(cache.join("snapshots")).ok()?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_dir())
        .max_by_key(|e| e.metadata().and_then(|m| m.modified()).ok())
        .map(|e| e.path())
}
```

### Default model on first launch

Seed the `embedder_config` table with `all-MiniLM-L6-v2` during migration so the app always has a valid config without any user action:

```rust
// db/migrations/001_initial.sql  (append at the end)
INSERT OR IGNORE INTO embedder_config
    (id, model_type, model_id, dimensions)
VALUES
    (1, 'local', 'all-MiniLM-L6-v2', 384);
```

`INSERT OR IGNORE` means this only runs once — subsequent migrations leave the row untouched even if the user has switched to a different model.

### Switching models (Option A — full re-index)

```rust
// indexing/pipeline.rs

#[tauri::command]
pub async fn switch_embedding_model(
    new_config: EmbedderConfig,
    state:      tauri::State<'_, AppState>,
    app:        tauri::AppHandle,
) -> Result<(), String> {
    // 1. build and validate the new embedder first — fail early before touching DB
    let new_embedder = build_embedder(&new_config, &state.model_paths.read().await, &app)
        .map_err(|e| e.to_string())?;

    // 2. wipe all embedding-dependent data
    {
        let db = state.db.lock().await;
        db.conn.execute_batch("
            DELETE FROM chunks;
            DELETE FROM semantic_links;
        ").map_err(|e| e.to_string())?;
    }

    // 3. swap the active embedder
    *state.embedder.write().await = new_embedder;

    // 4. persist the new config
    state.db.lock().await
        .update_embedder_config(&new_config)
        .map_err(|e| e.to_string())?;

    // 5. re-index all notes (emit progress events to frontend)
    reindex_all(&state, &app).await.map_err(|e| e.to_string())?;

    Ok(())
}

async fn reindex_all(
    state: &AppState,
    app:   &tauri::AppHandle,
) -> anyhow::Result<()> {
    let note_ids: Vec<String> = state.db.lock().await.all_note_ids()?;
    let total = note_ids.len();

    for (i, note_id) in note_ids.into_iter().enumerate() {
        run_pipeline_for_note(&note_id, state).await?;
        app.emit("reindex-progress", (i + 1, total)).ok();
    }

    Ok(())
}
```

### Saving a custom model path (Tauri command)

```rust
#[tauri::command]
pub fn validate_model_folder(path: String) -> ValidateResult {
    match probe_model_files(&path) {
        Ok(_)  => ValidateResult { ok: true,  error: None },
        Err(e) => ValidateResult { ok: false, error: Some(e.to_string()) },
    }
}

#[tauri::command]
pub async fn save_model_path(
    model_id: String,
    path:     String,
    state:    tauri::State<'_, AppState>,
) -> Result<(), String> {
    let db = state.db.lock().await;
    db.conn.execute(
        "INSERT INTO model_paths (model_id, path, verified_at)
         VALUES (?1, ?2, unixepoch())
         ON CONFLICT(model_id) DO UPDATE SET path=excluded.path, verified_at=excluded.verified_at",
        rusqlite::params![model_id, path],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
```