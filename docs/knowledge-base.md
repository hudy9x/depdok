# Knowledge Base - Architecture and Semantic Search Guide

## Purpose

This document is the source of truth for how the local knowledge base works today.
Use it when upgrading, debugging, or customizing semantic search.

Design goals:
- Offline-first by default.
- Embeddings and chunking run in Rust backend.
- Frontend only orchestrates file selection and command calls.
- Data stored locally in SQLite and queried with sqlite-vec.

---

## Current Code Structure

### Backend (Rust)

```text
src-tauri/src/knowledge_base/
|- mod.rs
|- db.rs
|- commands.rs
|- markdown_chunking/
|  |- mod.rs
|- embedding/
|  |- mod.rs
|  |- chunker.rs
|  |- fastembed.rs
|  |- openai.rs (unconditionally compiled)
```

Responsibilities:
- `db.rs`: initialize SQLite, schema, sqlite-vec extension.
- `embedding/mod.rs`: `Embedder` trait + provider init.
- `embedding/chunker.rs`: generic chunk splitting for embedding batches.
- `markdown_chunking/mod.rs`: markdown heading section splitting and section id slugging.
- `commands.rs`: all command entry points and internal operations.

Command registration:
- Commands are exported from `src-tauri/src/lib.rs` via `tauri::generate_handler!`.
- Current knowledge-base commands include:
  - `insert_or_replace_document`
  - `index_markdown_document_sections`
  - `delete_document`
  - `connect_to`
  - `search_similar`
  - `get_document`
  - `get_project_graph`
  - `set_current_project_group`
  - `test_database_query`
  - `get_current_embedding_model`
  - `update_embedding_model_and_reindex`

### Frontend (TypeScript)

```text
src/api-client/knowledge-base.ts
src/features/FileExplorer/MarkdownKnowledgeBaseDialog.tsx
src/features/FileExplorer/KnowledgeBaseSearchDialog.tsx
```

Responsibilities:
- `api-client/knowledge-base.ts`: typed invoke wrappers.
- `MarkdownKnowledgeBaseDialog.tsx`: scans markdown files, reads raw content, calls backend indexing command.
- `KnowledgeBaseSearchDialog.tsx`: runs semantic query and opens result file.

Important boundary:
- No markdown section chunking in frontend.
- Section chunking is backend-only (`markdown_chunking/mod.rs`).

---

## Data Model

Main tables:
- `documents(id, title, content)`
- `edges(id, source_id, target_id, type)`
- `groups(id, title)`
- `document_groups(document_id, group_id)`
- `documents_embeddings` (sqlite-vec virtual table)

Vector table notes:
- Stores embedding vectors per chunk.
- `chunk_id` format: `{document_id}#{index}`.
- `document_id` links each vector chunk back to a logical document record.

Foreign key note:
- sqlite-vec table does not support FK cascade.
- Always manually delete rows in `documents_embeddings` when deleting or replacing a document.

---

## Identifier Conventions

### Regular document id

```text
file:/absolute/path/to/file.md
```

### Section document id

```text
file:/absolute/path/to/file.md#section:logout
```

Duplicate heading handling:
- If a slug repeats, suffix with incremented index.
- Example: `#section:overview-2`.

Section slug generation:
- Lowercase.
- Keep alphanumeric.
- Convert whitespace and repeated separators to single hyphens.
- Fallback slug: `section`.

---

## Semantic Search: End-to-End Flow

## 1) Indexing markdown files

Frontend flow:
1. User opens Markdown scan dialog.
2. Frontend lists markdown files and reads selected file content.
3. For each file, frontend calls:
   - `index_markdown_document_sections(filePath, documentTitle, content, groupIds)`

Backend flow (`commands.rs`):
1. Build base id: `file:{file_path}`.
2. Find and delete stale rows for that file:
   - base document id
   - any prior section ids matching `file:{file_path}#section:%`
3. Split markdown with `split_markdown_into_sections`.
4. If no sections detected:
   - upsert a single document with base id.
5. If sections detected:
   - create one document per section id.
   - title pattern: `{document_title} - {section_title}`
   - content is section-only content.
6. For each document written, run embedding pipeline through `upsert_document_internal`.

Result:
- Search can match at section-level instead of full-file level.

## 2) Embedding generation

For each logical document (whole file fallback or section doc):
1. Split text into embedding chunks using `embedding/chunker.rs`.
2. Embed each chunk via active provider (`Embedder` trait object).
3. Store chunk vectors in `documents_embeddings` with `chunk_id = {document_id}#{index}`.

## 3) Query-time semantic search

Frontend:
1. User enters query in search dialog.
2. Frontend calls `search_similar(query, limit)`.

Backend (`search_similar_internal`):
1. Embed query text.
2. Run sqlite-vec KNN query on `documents_embeddings` with `MATCH` and `k`.
3. Join with `documents` to return:
   - `id`
   - `title`
   - `distance`

Frontend result handling:
1. Display title and score (`distance`).
2. Parse id for open action:
   - remove `file:` prefix
   - if id contains `#section:`, strip section suffix before opening editor tab.

Result:
- Retrieval granularity is section-level.
- Opening behavior still targets the source file.

---

## Command Contracts

### `insert_or_replace_document`

Use for generic programmatic upserts.

Inputs:
- `id: Option<String>`
- `title: String`
- `content: String`
- `group_ids: Vec<String>`

Output:
- `Result<String, String>` returning final document id.

### `index_markdown_document_sections`

Use for markdown file indexing from UI and automation.

Inputs:
- `file_path: String`
- `document_title: String`
- `content: String`
- `group_ids: Vec<String>`

Output:
- `Result<usize, String>` returning number of indexed section documents.

### `search_similar`

Inputs:
- `query: String`
- `limit: usize`

Output:
- `Result<Vec<SearchResult>, String>` where `SearchResult = { id, title, distance }`.

---

## How To Extend Safely

## Add new embedding provider

1. Implement `Embedder` in `embedding/`.
2. Return provider from `embedding::init_embedder` based on config/feature.
3. Ensure `dimensions()` matches vector schema initialization.
4. Keep command layer unchanged.

## Change markdown section parsing

1. Edit only `markdown_chunking/mod.rs`.
2. Preserve id format: `file:{path}#section:{slug}`.
3. Keep duplicate slug disambiguation deterministic.
4. Reindex documents after parser changes.

## Tune retrieval behavior

Options:
- adjust search limit at caller.
- add dedup/grouping by document id prefix if needed.
- add score threshold post-filtering in backend.

Guideline:
- Prefer backend-side logic for ranking/filtering so behavior stays consistent across UI surfaces.

---

## Dynamic Embedding Models

The application supports selecting from a list of local (offline) and remote (online) embedding models. 

### Local Models (Offline)
Supported local models include:
- `all-MiniLM-L6-v2` (384 dimensions)
- `all-MiniLM-L12-v2` (384 dimensions)
- `bge-small-en-v1.5` (384 dimensions)
- `bge-base-en-v1.5` (768 dimensions)
- `bge-large-en-v1.5` (1024 dimensions)
- `nomic-embed-text-v1.5` (768 dimensions)
- `multilingual-e5-small` (384 dimensions, Multilingual 100+)
- `multilingual-e5-base` (768 dimensions, Multilingual 100+)
- `multilingual-e5-large` (1024 dimensions, Multilingual 100+)
- `paraphrase-multilingual-MiniLM-L12-v2` (384 dimensions, Multilingual 50+)
- `bge-small-zh-v1.5` (512 dimensions, Chinese & English)
- `bge-large-zh-v1.5` (1024 dimensions, Chinese & English)

### Remote Models (Online)
Supported remote models include:
- `text-embedding-3-small` (1536 dimensions)
- `text-embedding-3-large` (3072 dimensions)
- `text-embedding-ada-002` (1536 dimensions)

*Note: Remote models require an OpenAI API Key configured in Settings.*

### Changing Embedding Models & Reindexing
Because `sqlite-vec` virtual tables (vec0) do not support changing embedding dimensions dynamically after creation:
1. When switching models, the backend starts a transaction to **drop** the `documents_embeddings` table and **delete** all existing document chunk rows.
2. It recreates `documents_embeddings` with the new dimension count of the selected model.
3. The active workspace root directory is traversed to re-index all markdown files and re-generate vector embeddings.

---

## Operational Notes

- Default provider is local fastembed (offline after first model download).
- OpenAI provider is unconditionally compiled and requires a user-provided API key stored in `store.json`.
- All command errors should return `Result<_, String>` without panic.
- Database location is under app data directory as `knowledge_base.db`.
- The active model type, name, and api keys are persisted in `store.json`.

---

## AI Maintenance Rules

When asked to modify semantic search:
1. Check backend flow first (`commands.rs`, `markdown_chunking/mod.rs`, `embedding/`).
2. Keep frontend free of chunking/parsing business logic.
3. Preserve id conventions to avoid breaking result opening.
4. If changing schema or id format, include migration or reindex path.
5. Validate both:
   - frontend build
   - `cargo check` in `src-tauri`

This prevents regressions and keeps retrieval behavior stable across upgrades.
