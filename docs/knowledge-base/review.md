# Local RAG Production Review Checklist

Use this document to review the desktop RAG application before release or after a major indexing/retrieval change.

## Review metadata

- Review date: 
- Reviewer: 
- App version: 
- Git commit: 
- SQLite schema version: 
- Embedding model and version: 
- Chat model and version: 
- sqlite-vec version: 
- Test corpus: 

Legend: `[ ]` not reviewed · `[x]` verified · `[!]` issue found · `[-]` not applicable

## 1. Product and answer contract

- [ ] The app clearly distinguishes facts found in project documents from model-generated suggestions.
- [ ] Answers include clickable or otherwise usable source references.
- [ ] A source reference includes at least the file, heading/section, and relevant line range when available.
- [ ] The app says when evidence is insufficient instead of inventing an answer.
- [ ] Conflicting documents are reported explicitly.
- [ ] Proposed, accepted, rejected, superseded, and unknown decisions are distinguished.
- [ ] The UI shows indexing state and data freshness.
- [ ] The user can inspect the retrieved evidence behind an answer.
- [ ] The user can re-index a document or project without rebuilding the entire database.

## 2. Tauri and Rust architecture

- [ ] Long-running indexing work runs outside the Tauri UI thread.
- [ ] Indexing can be cancelled safely.
- [ ] The UI receives progress events with processed, remaining, failed, and skipped counts.
- [ ] Rust commands validate all arguments before touching the filesystem or database.
- [ ] Tauri command inputs and outputs use explicit serializable types rather than loosely shaped values.
- [ ] Errors are converted into user-safe messages while retaining diagnostic details in logs.
- [ ] Commands do not expose arbitrary filesystem reads, writes, or SQL execution.
- [ ] All paths are canonicalized and constrained to configured project roots.
- [ ] File watching is debounced so one save does not trigger multiple indexing jobs.
- [ ] Concurrent indexing and querying behavior is defined and tested.
- [ ] SQLite connections are configured appropriately for the desktop workload.
- [ ] Database migrations are versioned, transactional, and tested against an existing production database.
- [ ] The app can recover from an interrupted indexing job without corrupting the index.
- [ ] Panic paths and native-extension loading failures are handled without crashing the application.

## 3. Markdown ingestion

- [ ] Every source file has a stable document ID.
- [ ] The file path, project, folder/type, title, author, dates, tags, and content hash are stored.
- [ ] YAML frontmatter is parsed and validated.
- [ ] Missing or malformed frontmatter has a defined fallback behavior.
- [ ] Markdown headings, lists, tables, code blocks, links, and blockquotes are parsed correctly.
- [ ] Tables are kept semantically intact during chunking.
- [ ] Code blocks are preserved and labeled as code when they contain technical evidence.
- [ ] File encoding problems are detected and reported.
- [ ] Symlinks, duplicate paths, ignored folders, and deleted files have defined behavior.
- [ ] A content hash prevents unnecessary re-embedding of unchanged documents.
- [ ] File deletion removes or marks stale document, chunk, FTS, and vector records.
- [ ] Re-indexing the same file is idempotent.
- [ ] Indexing records the parser, chunker, and embedding configuration used.

## 4. Document taxonomy and metadata

- [ ] The folder types are represented as explicit metadata, not inferred only from paths.
- [ ] Supported types include `decisions`, `requirements`, `specifications`, `technicals`, `meetings`, `plan`, `architecture`, and `daily-reports`.
- [ ] Project identity is stored separately from document type.
- [ ] Documents have normalized created, updated, and effective/decision dates where available.
- [ ] Authors, proposers, approvers, owners, attendees, and reviewers are represented consistently.
- [ ] Documents can be marked as draft, active, accepted, rejected, superseded, or archived.
- [ ] A superseding decision can link to the decision it replaces.
- [ ] Tags and technology names use normalized forms or aliases.
- [ ] Document authority rules are defined; for example, accepted decisions outrank meeting notes.
- [ ] The app can filter retrieval by project, document type, date, status, owner, and technology.

## 5. Chunking and context preservation

- [ ] Chunk boundaries follow Markdown sections before falling back to token/character limits.
- [ ] Headings and the full heading path are included with every embedded chunk.
- [ ] Document title, type, project, and relevant dates are included in the embedding text or stored as retrieval metadata.
- [ ] Decisions, requirements, estimates, and table rows are not split in the middle of a logical unit.
- [ ] Chunk size and overlap are documented and configurable.
- [ ] Oversized sections are split by paragraphs or list boundaries.
- [ ] Every chunk has an ordinal position within its section and document.
- [ ] Previous/next chunk links are available for context expansion.
- [ ] Retrieved chunks can expand to their parent section.
- [ ] Neighbor expansion has a token budget and does not flood the prompt.
- [ ] Summary chunks, if used, link to the original source chunks.
- [ ] Original text is never replaced by an automatically generated summary.
- [ ] Chunk text is deterministic: re-indexing the same source with the same configuration produces the same chunks.

## 6. Embeddings

- [ ] The chat model is not incorrectly used as the embedding model.
- [ ] A dedicated embedding model is selected and pinned.
- [ ] The model supports the languages used in the project documentation.
- [ ] Query and document embeddings use the same model, dimensions, normalization, and distance metric.
- [ ] Query embeddings use the model's recommended retrieval instruction format when applicable.
- [ ] Document embeddings do not include unnecessary boilerplate that dominates similarity.
- [ ] Embeddings are generated in batches where supported.
- [ ] Embedding failures are retried and recorded per chunk.
- [ ] The app detects an unavailable Ollama model before starting a large indexing job.
- [ ] The embedding model name, version, dimensions, and configuration are stored with the index.
- [ ] Changing the embedding model triggers a new index namespace or a complete rebuild.
- [ ] Embedding vectors are validated for dimension, finite values, and expected numeric type.
- [ ] The app does not silently truncate text beyond the embedding model's context limit.

## 7. SQLite and sqlite-vec data model

- [ ] Documents, sections, chunks, ingestion jobs, and embedding configurations have normal SQLite tables.
- [ ] Vector rows have a stable link to the canonical chunk ID.
- [ ] FTS5 rows have a stable link to the canonical chunk ID.
- [ ] Foreign keys are enabled and integrity checks are part of diagnostics.
- [ ] Unique constraints prevent duplicate documents and duplicate chunk versions.
- [ ] Stale index records can be identified and removed.
- [ ] Vector dimensions are enforced by the schema or by insertion validation.
- [ ] Metadata needed for pre-filtering is available near the vector search.
- [ ] Large chunk text is not duplicated unnecessarily inside vector metadata columns.
- [ ] Vector and ordinary-table updates are coordinated transactionally where possible.
- [ ] sqlite-vec version is pinned because the project is pre-1.0.
- [ ] The app has a supported strategy for rebuilding the vector table after extension changes.
- [ ] Database backup includes both ordinary SQLite data and vector index data.
- [ ] `PRAGMA integrity_check` and application-level index consistency checks are available.
- [ ] WAL, busy timeout, checkpointing, and read/write concurrency settings are tested on supported platforms.

## 8. Search and retrieval

- [ ] Retrieval combines semantic vector search and SQLite FTS5 keyword search.
- [ ] Exact identifiers, dates, migration names, ticket IDs, and technology names can be found lexically.
- [ ] Semantic search handles paraphrased questions.
- [ ] Query filters are extracted before retrieval when the question specifies project, type, date, person, or technology.
- [ ] Retrieval uses a configurable candidate count, such as top 20 from each search method.
- [ ] Vector and FTS results are merged with a documented ranking method.
- [ ] Duplicate chunks from the same section are deduplicated or grouped.
- [ ] Results are diversified across documents when appropriate.
- [ ] Parent and neighboring context is added after candidate selection.
- [ ] A reranker is either implemented, deliberately deferred, or shown to be unnecessary through evaluation.
- [ ] Retrieval logs query text, filters, candidate scores, selected chunks, and latency locally for debugging.
- [ ] Empty-result behavior is defined and tested.
- [ ] Retrieval respects document status and authority rules.
- [ ] Old superseded decisions do not outrank current accepted decisions without an explicit historical query.

## 9. Query routing and answer modes

- [ ] The app classifies questions into modes such as progress, decision lookup, rationale, ownership, chronology, and estimation review.
- [ ] Multi-part questions are decomposed into subquestions.
- [ ] “When” questions prioritize dates and chronological evidence.
- [ ] “Who” questions prioritize structured people fields, meeting attendees, and approval records.
- [ ] Progress questions prioritize recent plans and daily reports.
- [ ] Decision questions prioritize accepted decision records over informal discussions.
- [ ] Estimation questions retrieve requirements, architecture, dependencies, assumptions, and existing estimates together.
- [ ] The app can answer with a timeline when chronology is important.
- [ ] The app can answer with a comparison table when alternatives or estimates are involved.
- [ ] Query rewriting is bounded in length and does not replace the original question.
- [ ] The original user question remains available to the final answer prompt.

## 10. Context assembly and Qwen3.5 generation

- [ ] The final prompt has a strict token budget suitable for `qwen3.5:2b`.
- [ ] Evidence is labeled with source, heading, date, and chunk ID.
- [ ] Evidence is ordered by relevance and authority, not only by insertion order.
- [ ] The prompt instructs the model to use only supplied evidence.
- [ ] The prompt requires uncertainty when evidence is missing.
- [ ] The prompt requires conflicts to be reported.
- [ ] The prompt distinguishes facts from recommendations.
- [ ] The model is instructed not to invent dates, people, approval status, or estimates.
- [ ] Structured output is validated before being displayed.
- [ ] Invalid JSON or incomplete model output has a safe fallback.
- [ ] Streaming output does not expose unsupported intermediate reasoning or unvalidated claims.
- [ ] The UI clearly separates answer, evidence, assumptions, conflicts, and unknowns.
- [ ] Temperature, context size, and reasoning settings are pinned or documented.

## 11. Structured project knowledge

- [ ] Decisions have subject, outcome, rationale, date, proposer, approver, status, and superseded-by fields.
- [ ] Requirements have ID, description, priority, status, acceptance criteria, and source.
- [ ] Architecture records identify components, dependencies, interfaces, risks, and affected requirements.
- [ ] Plans identify tasks, owners, status, dependencies, and target dates.
- [ ] Daily reports identify completed work, blockers, next steps, and report date.
- [ ] Meeting records identify date, attendees, decisions, and action items.
- [ ] Structured extraction preserves a link to the exact Markdown evidence.
- [ ] Users can correct extracted structured facts.
- [ ] Corrections are not overwritten silently by the next indexing run.
- [ ] Structured facts have provenance and confidence fields.

## 12. Use-case acceptance tests

### Current progress

- [ ] The answer includes completed work, active work, blockers, and next steps.
- [ ] The answer prioritizes recent reports and plans.
- [ ] The answer identifies the reporting period.
- [ ] The answer cites the source of each major status claim.
- [ ] Contradictory status reports are shown rather than silently merged.

### Database migration decision

- [ ] The system finds the accepted migration decision by exact term and semantic paraphrase.
- [ ] The answer identifies what was decided, when, by whom, and why.
- [ ] The answer identifies rejected or superseded alternatives when documented.
- [ ] The answer distinguishes proposal date from approval date.

### Technology rationale and ownership

- [ ] The system finds the technology decision even when the user uses a synonym.
- [ ] The answer explains the problem, tradeoffs, and timing.
- [ ] The answer distinguishes proposer, reviewer, and approver.
- [ ] The answer cites both the decision and supporting technical evidence.

### Estimation review

- [ ] Requirements are mapped to architecture components or the missing mapping is reported.
- [ ] Existing estimates and their assumptions are retrieved.
- [ ] Missing work, dependencies, integration work, testing, migration, rollback, and operational tasks are considered.
- [ ] The model does not change numeric estimates without showing the reason.
- [ ] Totals are calculated deterministically by application code.
- [ ] The output includes confidence and unresolved risks.

## 13. Security and privacy

- [ ] Project roots are explicitly configured and access-controlled.
- [ ] Sensitive files can be excluded from indexing.
- [ ] Logs do not leak document contents or credentials.
- [ ] Prompt and answer history storage is opt-in or clearly disclosed.
- [ ] Ollama is accessed only through the intended local endpoint.
- [ ] Extension loading paths are controlled and validated.
- [ ] Imported Markdown cannot execute code through the UI.
- [ ] Rendered Markdown is sanitized against script injection.
- [ ] External links are treated as untrusted content.
- [ ] Backups and exported indexes have documented privacy behavior.

## 14. Performance and reliability

- [ ] Initial indexing time is measured on a representative project.
- [ ] Incremental indexing time is measured after changing one file.
- [ ] Query latency is measured separately for embedding, FTS5, vector search, context assembly, and generation.
- [ ] The UI remains responsive during indexing and generation.
- [ ] Memory use is measured for small, medium, and large projects.
- [ ] Large documents do not cause unbounded memory growth.
- [ ] Failed files do not stop the entire indexing job unless explicitly configured.
- [ ] The app resumes or safely restarts after interruption.
- [ ] Database backups and restores have been tested.
- [ ] The app behaves correctly when Ollama is stopped, slow, or missing a model.
- [ ] The app behaves correctly when the sqlite-vec extension cannot be loaded.
- [ ] Supported macOS, Windows, and Linux builds have been tested if cross-platform support is claimed.

## 15. Evaluation and regression testing

- [ ] A fixed evaluation set contains real questions from every supported use case.
- [ ] The evaluation set includes exact lookups, paraphrases, multi-part questions, and unanswerable questions.
- [ ] Retrieval recall@5 and recall@10 are measured.
- [ ] Citation correctness is checked.
- [ ] Date, person, status, and decision-state accuracy are checked separately.
- [ ] Estimation review is evaluated for missing work and arithmetic correctness.
- [ ] Tests cover conflicting documents and superseded decisions.
- [ ] Tests cover deleted, renamed, and modified Markdown files.
- [ ] Tests cover embedding-model changes and index rebuilds.
- [ ] A regression fixture is saved for every production retrieval bug.
- [ ] The app records enough local diagnostics to reproduce a failed answer.

## 16. Release gate

- [ ] No unresolved critical issues remain in ingestion, retrieval, data integrity, or source attribution.
- [ ] Database migration and rollback have been tested from a real previous release.
- [ ] A fresh installation can create and query an index successfully.
- [ ] An existing installation can upgrade without losing documents or vectors.
- [ ] Backup and restore have been verified.
- [ ] Ollama model prerequisites are detected and explained to the user.
- [ ] The app has a clear recovery path for corrupted or stale indexes.
- [ ] The evaluation set meets the agreed quality threshold.
- [ ] Known limitations are documented in the product UI or release notes.
- [ ] The reviewer has signed off on the release.

## Findings

| ID | Area | Severity | Finding | Owner | Target version | Status |
|---|---|---|---|---|---|---|
| RAG-001 |  | Critical/High/Medium/Low |  |  |  | Open |

## Final decision

- [ ] Approved for production
- [ ] Approved with documented limitations
- [ ] Not approved; remediation required

Notes:

____________________________________________________________

____________________________________________________________
