# Depdok MCP Connectivity Plan

## Goal

Enable AI agents (including Codex) to access Depdok knowledge-base capabilities through MCP, using only Approach B: direct stdio transport.

Packaging requirement:
- User installs only one Depdok MCP binary.
- No separate runtime, package manager, daemon, or helper installation is required.

No implementation is included here. This is planning only.

---

## Current State Summary

Depdok already has backend operations in Rust that can be reused as MCP tools:
- document upsert and section indexing
- semantic search
- graph retrieval
- graph edge creation
- document fetch and deletion

Relevant backend entry points are currently in:
- src-tauri/src/knowledge_base/commands.rs

Key constraint:
- Section-level indexing is already enabled in the knowledge base, but graph UI currently aggregates to file-level display.

---

## Shared Design Principles

1. Reuse core Rust business logic
- Extract reusable service/internal layer from command wrappers.
- Keep Tauri command functions as thin adapters.
- MCP handlers call the same internal functions.

2. Keep data local
- Continue using local SQLite knowledge base.
- No mandatory cloud dependency.

3. Stable MCP tool contracts
- Define clear inputs, outputs, and error objects.
- Version tool schemas to support future changes.

4. Security by default
- Restrict write-capable tools via config.
- Add explicit allowlist for tool exposure.

5. Observability and reliability
- Structured logs for each MCP request.
- Request timeout and payload-size limits.
- Health checks for startup and operational diagnostics.

---

## Approach B: Direct stdio Connectivity (MCP over stdin/stdout)

### High-level idea

Run a dedicated MCP server binary that communicates via stdin/stdout JSON-RPC with no HTTP listener.

### Binary-only delivery model

1. Build a single standalone binary
- Name target: depdok-mcp-server
- Contains stdio transport, tool handlers, config parsing, and knowledge-base service wiring.

2. No external install dependency for end users
- No Node installation required.
- No Python installation required.
- No separate MCP bridge package required.
- No manual sqlite or embedding package install required.

3. Runtime behavior
- AI client launches one executable as MCP process.
- Binary communicates through stdin/stdout only.
- Binary reads Depdok knowledge base directly.

4. Configuration strategy
- Defaults are embedded in binary.
- Optional overrides via environment variables or one optional config file.
- Binary must run with sane defaults without extra setup.

### Proposed architecture

1. New Rust binary for MCP server
- Path suggestion: src-tauri/src/bin/depdok-mcp-server.rs
- Reuse shared knowledge base service module.

2. Transport
- MCP over stdio only.
- No bound network port by default.

3. Auth and trust model
- Primary trust boundary is local process launch control.
- Optional session token check can be supported for defense in depth.

4. Tool exposure
- Start with read-only tools first, then add write tools behind feature flag or policy.

### Proposed folder structure (high level)

Keep the structure minimal and purpose-driven:

- `src-tauri/src/bin/`
  - Goal: binary entrypoint only.
  - Includes the single user-facing executable launcher for MCP stdio mode.

- `src-tauri/src/mcp_server/`
  - Goal: MCP runtime layer.
  - Contains stdio transport, tool routing, request validation, middleware, and runtime configuration.

- `src-tauri/src/knowledge_base/`
  - Goal: core domain logic and data access.
  - Reused by both Tauri commands and MCP tools to avoid duplicated logic.

- `src-tauri/tests/`
  - Goal: contract and integration validation.
  - Covers stdio behavior, tool schemas, and critical read/write flows.

### ASCII architecture diagram

```text
      +------------------------------+
      | AI Agent (Codex/Claude/Gemini)
      | MCP Client (stdio transport) |
      +---------------+--------------+
                      |
                      | stdin/stdout JSON-RPC
                      v
      +-------------------------------+
      | depdok-mcp-server (single bin)|
      |-------------------------------|
      | stdio transport + tool router |
      | MCP tool handlers             |
      | Shared KB service layer (Rust)|
      +---------------+---------------+
                      |
                      | internal function calls
                      v
      +-------------------------------+
      | Depdok Knowledge Base Core    |
      | commands/service + SQL + embed|
      +---------------+---------------+
                      |
                      | SQLite queries
                      v
      +-------------------------------+
      | knowledge_base.db (local file)|
      +-------------------------------+
```

### Integration to Codex, Claude, and Gemini

This plan supports one local MCP process that each client launches.

1. Build or ship the binary
- Binary path example: `/usr/local/bin/depdok-mcp-server`

2. Register server in each client
- Transport: stdio
- Command: path to binary
- Args: optional, for mode or config path
- Env: optional, for profile and write-policy flags

3. Validate with read tools first
- `kb_get_status`
- `kb_search_similar`

4. Enable write tools after validation
- `kb_index_markdown_document_sections`
- `kb_connect_documents`
- `kb_delete_document`

#### Codex template

```json
{
  "name": "depdok",
  "transport": "stdio",
  "command": "/absolute/path/to/depdok-mcp-server",
  "args": [],
  "env": {
    "DEPDOK_MCP_MODE": "stdio"
  }
}
```

#### Claude template

```json
{
  "name": "depdok",
  "transport": "stdio",
  "command": "/absolute/path/to/depdok-mcp-server",
  "args": [],
  "env": {
    "DEPDOK_MCP_MODE": "stdio"
  }
}
```

#### Gemini template

```json
{
  "name": "depdok",
  "transport": "stdio",
  "command": "/absolute/path/to/depdok-mcp-server",
  "args": [],
  "env": {
    "DEPDOK_MCP_MODE": "stdio"
  }
}
```

Notes:
- Exact config keys may differ by app version, but these fields are the required mapping.
- Launch process with least privilege and local filesystem scope only.
- Start in read-only mode first, then enable write tools intentionally.

### Suggested MCP tools (first pass)

Read tools:
- kb_search_similar
- kb_get_document
- kb_get_project_graph
- kb_get_status

Write tools (phase 2):
- kb_index_markdown_document_sections
- kb_connect_documents
- kb_delete_document

### Pros

- Lowest network exposure because no HTTP listener is required.
- One-binary user experience with no additional install burden.
- Good fit for local agent workflows across Codex, Claude, and Gemini.
- Simpler security posture than network transports.

### Cons

- Harder to share one MCP instance across multiple independent clients.
- Process lifecycle is tied to each client launcher.
- Centralized monitoring is less convenient than service-style HTTP deployment.

### Risks and mitigations

1. Process crash or early exit
- Mitigation: client-side restart policy and graceful shutdown hooks.

2. Data corruption from uncontrolled writes
- Mitigation: read-only mode default and explicit write-tool enablement.

3. Schema drift between Tauri and MCP adapters
- Mitigation: shared internal service module and shared DTO types.

### Rollout phases

1. Phase B1
- Shared internal service extraction.
- Read-only MCP stdio tools.
- Produce single-binary build artifact.

2. Phase B2
- Add request limits, robust error mapping, and startup diagnostics.
- Validate zero-extra-install startup on macOS first.

3. Phase B3
- Add write tools with policy gate.

4. Phase B4
- Add integration tests and tool contract snapshot tests.

---

## Recommendation

Implement this stdio single-binary plan directly as the primary MCP integration path.

---

## Proposed Deliverables (for implementation phase later)

1. Shared service module extracted from current command internals.
2. MCP server single binary with stdio transport enabled by default.
3. Tool schema definitions and versioning policy.
4. Config file and env strategy for mode, auth, and write-policy.
5. Integration tests:
- read-only tools
- write tools
- error handling
- UTF-8 safety in indexing/search flows

---

## Open Questions for Review

1. Do you want write tools enabled in first release, or read-only first?
2. Should optional session-token verification be required even in stdio mode?
3. Should one long-running process be shared per user session, or one process per client?
4. Should graph tool responses be file-level aggregated by default, section-level, or both via parameter?
5. Do you want tool response limits and pagination defined now, especially for large project graphs?
