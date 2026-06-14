# Knowledge Base Implementation Summary

This document is a short handoff summary of the local knowledge base work implemented in this repository.

## Goal

Add an offline-first local knowledge base for markdown/file content using:
- SQLite via `rusqlite`
- `sqlite-vec` for vector similarity search
- `fastembed` with `all-MiniLM-L6-v2` as the default embedding model

## Backend Structure

Knowledge base Rust code lives in:

```text
src-tauri/src/knowledge_base/
├── mod.rs
├── db.rs
├── commands.rs
├── embedding/
│   ├── mod.rs
│   ├── chunker.rs
│   ├── fastembed.rs
│   └── openai.rs
└── tests/
    ├── mod.rs
    └── internal_commands.rs
```

## What Was Implemented

### 1. Database initialization

File: `src-tauri/src/knowledge_base/db.rs`

- Initializes SQLite in the app data directory.
- Registers `sqlite-vec` through `sqlite3_auto_extension` before opening the DB.
- Enables `PRAGMA foreign_keys = ON`.
- Creates these tables:
  - `documents`
  - `edges`
  - `documents_embeddings`

### 2. Embedding subsystem

Folder: `src-tauri/src/knowledge_base/embedding/`

- `Embedder` trait for provider-agnostic embedding.
- `FastEmbedProvider` as the default implementation.
- `OpenAiProvider` scaffolded behind a feature flag for future use.
- `chunker.rs` performs character-window chunking with overlap and boundary-aware splitting.

### 3. Tauri commands

File: `src-tauri/src/knowledge_base/commands.rs`

Public commands exposed to the frontend:
- `insert_or_replace_document`
- `delete_document`
- `connect_to`
- `search_similar`
- `get_document`
- `test_database_query`

### 4. Internal Rust-only functions

Also in `commands.rs`, each major operation now has an internal Rust function so the logic can be called directly from tests or other backend code without going through Tauri state wrappers.

Internal functions:
- `upsert_document_internal`
- `delete_document_internal`
- `connect_to_internal`
- `search_similar_internal`
- `get_document_internal`
- `test_database_query_internal`

This pattern was added to make Rust-side testing straightforward.

### 5. Auto-sync from file writes

File: `src-tauri/src/commands/files.rs`

When files are created or written through the Rust file commands:
- the knowledge base auto-upserts the file content
- the operation is debounced by 500ms per file path
- Rust logs are printed when the debounced sync runs

Current hooked commands:
- `write_file_content`
- `create_file`

Document ID for file-backed documents is deterministic:

```text
file:{absolute_path}
```

That prevents duplicates on repeated updates.

### 6. Frontend test dialog

Frontend files:
- `src/components/Footer.tsx`
- `src/api-client/knowledgeBase.ts`

A simple `KB Test` button was added in the footer.
It opens a dialog where clicking `Test` calls `test_database_query` and renders the JSON result returned from Rust.

## Storage Paths

### Database path on macOS

```text
/Users/hudy/Library/Application Support/com.depdok.app/knowledge_base.db
```

### Embedding model cache path on macOS

```text
/Users/hudy/Library/Caches/com.depdok.app/models--Qdrant--all-MiniLM-L6-v2-onnx
```

## Current Chunking Algorithm

File: `src-tauri/src/knowledge_base/embedding/chunker.rs`

Current chunking is:
- character-based
- overlapping windows
- UTF-8 boundary safe
- split preference order:
  1. paragraph break (`\n\n`)
  2. newline / sentence punctuation (`\n`, `.`, `!`, `?`, `;`)
  3. space
  4. hard split

Default options:
- `max_chars = 512`
- `overlap_chars = 64`

## What Embeddings Are Used For

The embedding pipeline converts document chunks into vectors for semantic search.

Flow:
1. Document text is chunked.
2. Each chunk is embedded into a float vector.
3. Vectors are stored in `documents_embeddings`.
4. Query text is embedded and matched against stored vectors in `search_similar`.

This supports semantic retrieval, not only exact keyword matching.

## How To Run The Rust Tests

Tests were added in:

```text
src-tauri/src/knowledge_base/tests/
```

Run only these KB tests:

```bash
cd /Users/hudy/ws/depdok/src-tauri
cargo test knowledge_base::tests -- --nocapture
```

At the time this summary was written, these tests passed:
- `upsert_and_get_document_internal_works`
- `connect_and_delete_document_internal_works`
- `test_database_query_internal_returns_counts`

## How To Query The Database Manually

You can inspect the database directly using SQLite:

```bash
sqlite3 "/Users/hudy/Library/Application Support/com.depdok.app/knowledge_base.db"
```

Useful queries:

```sql
.tables
.schema documents
.schema edges
SELECT COUNT(*) FROM documents;
SELECT COUNT(*) FROM edges;
SELECT id, title FROM documents ORDER BY rowid DESC LIMIT 10;
```

Note:
Querying the `documents_embeddings` virtual table from plain `sqlite3` may not work unless the `sqlite-vec` extension is loaded in that environment.

## Known Limitations / Next Steps

- `search_similar_internal` exists, but the current Rust test suite does not yet exercise real vector search against `sqlite-vec`.
- `OpenAiProvider` is scaffolded but not wired to app settings yet.
- The current chunker is char-based, not token-based.
- Auto-sync currently hooks file create/write commands, not every possible file mutation source in the app.

## Good Resume Prompt For A Future Session

Use something like this in a future chat:

```text
Read docs/knowledge-base-summary.md and continue the knowledge base work.
Focus on: [your next task].
```
