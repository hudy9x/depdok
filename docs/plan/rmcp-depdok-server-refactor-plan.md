# Refactor Plan: Hand-Rolled MCP Server → `rmcp` (Minimal, 3 Tools)

**Scope:** `src-tauri/src/bin/*`, `src-tauri/src/mcp_server/**`
**Goal:** Replace the hand-rolled JSON-RPC/stdio loop with `rmcp`, fix the crash-on-error bug, and expose **only three tools** — no write tools, no document/graph/chunk tools.
**Untouched:** `knowledge_base::{db, embedding, manager}` stays exactly where it is, outside `mcp_server/`. Its other methods (`get_chunk_context`, `get_document`, `get_project_graph`, `delete_document`) are not deleted — they may still be used elsewhere in the Tauri app (e.g. frontend commands) even though they're no longer exposed over MCP. Don't treat them as dead code just because this refactor stops calling them.

## Public tool surface (final)

| Public tool name | Maps to | Args |
|---|---|---|
| `depdok_get_status` | old `kb_get_status` | none |
| `depdok_kb_search` | old `kb_search_hybrid`/`kb_query`/`kb_search` (pick one underlying impl, drop the other two alias names) | `query` (required), `limit` (optional, default 10) |
| `depdok_kb_search_similar` | old `kb_search_similar` | `query` (required), `limit` (optional, default 10) |

No write tools, no `write_enabled` gating, no `kb_connect_documents`/`kb_delete_document` in this surface. If `config.rs` still parses a `--write-enabled` flag from old deployments, that's now a harmless no-op (`CliArgs::parse()` already silently ignores unrecognized flags via its `_ => {}` arm, so nothing breaks if the flag is still passed in your Tauri client config — it just does nothing).

## Folder structure

```
src-tauri/src/
  mcp_server/
    mod.rs                  # run(), build_state() — wiring only
    config.rs               # simplified: write_enabled no longer needed by this layer
    service.rs              # KbMcpService struct + ServerHandler impl + constructor
    tools/
      mod.rs
      knowledge_base.rs      # the 3 #[tool] methods, calling into KbManager
  knowledge_base/            # untouched
    db.rs
    embedding.rs
    manager.rs
```

---

## Phase 0 — Inventory

1. `Cargo.toml` — current deps, `[[bin]]` entries.
2. `src-tauri/src/bin/*` — confirm the entrypoint just calls `mcp_server::run()`; note any stdout logging before that call.
3. `knowledge_base/manager.rs` — confirm signatures for `search_similar` and `search_hybrid` specifically (the only two you still need), and that `KbManager` is `Send + Sync + 'static`.
4. Grep for `DEPDOK_MCP_MODE` (used in your client config) and confirm where it's consumed.
5. Check dependencies for anything writing to stdout by default.

---

## Phase 1 — Lock the contract

Before writing code, write down:

- The three tool names and their args, exactly as in the table above.
- `depdok_kb_search` calls `KbManager::search_hybrid` — confirm this is the right one to keep (vs. `search_similar`) by checking what the old `kb_query`/`kb_search` aliases actually pointed to (they did — both called `search_hybrid` in the old `mod.rs`).
- Whether to keep the old `structuredContent` + `content` dual-output shape (check if `rmcp`'s `CallToolResult` in your installed version supports `structured_content`).

---

## Phase 2 — Add `rmcp`, scaffold `KbMcpService`

```toml
[dependencies]
rmcp = { version = "1.8.0", features = ["server", "transport-io", "schemars"] }
schemars = "1.0"
```

```rust
// mcp_server/service.rs
use rmcp::{handler::server::router::tool::ToolRouter, model::*, ServerHandler};
use std::sync::Arc;

use crate::knowledge_base::manager::KbManager;
use crate::mcp_server::McpServerConfig;

#[derive(Clone)]
pub struct KbMcpService {
    pub(crate) config: McpServerConfig,
    pub(crate) kb_manager: Arc<KbManager>,
    tool_router: ToolRouter<KbMcpService>,
}

impl KbMcpService {
    pub fn new(config: McpServerConfig, kb_manager: KbManager) -> Self {
        Self {
            config,
            kb_manager: Arc::new(kb_manager),
            tool_router: Self::tool_router(),
        }
    }
}

#[rmcp::tool_handler]
impl ServerHandler for KbMcpService {
    fn get_info(&self) -> ServerInfo { /* Phase 4 */ todo!() }
}
```

Build this alongside the still-existing old `mod.rs` so both compile; cut over only after Phase 6.

---

## Phase 3 — Port the 3 tools

```rust
// mcp_server/tools/knowledge_base.rs
use rmcp::{handler::server::tool::Parameters, model::*, tool, tool_router, ErrorData as McpError};
use serde::Deserialize;
use super::super::service::KbMcpService;

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct SearchRequest {
    pub query: String,
    pub limit: Option<usize>,
}

#[tool_router]
impl KbMcpService {
    #[tool(description = "Return SQLite version, database path, and record counts for the knowledge base.")]
    async fn depdok_get_status(&self) -> Result<CallToolResult, McpError> {
        // port the body of the old "kb_get_status" match arm, using self.kb_manager / self.kb_manager.db_lock()
        todo!()
    }

    #[tool(description = "Search the knowledge base using hybrid keyword (FTS5) + semantic (vector) search.")]
    async fn depdok_kb_search(&self, Parameters(req): Parameters<SearchRequest>) -> Result<CallToolResult, McpError> {
        let limit = req.limit.unwrap_or(10);
        let results = self.kb_manager.search_hybrid(req.query, limit).await
            .map_err(|e| McpError::internal_error(e, None))?;
        // build CallToolResult the same way the old code did (pretty JSON text + structuredContent if supported)
        todo!()
    }

    #[tool(description = "Search the knowledge base for semantically similar documents.")]
    async fn depdok_kb_search_similar(&self, Parameters(req): Parameters<SearchRequest>) -> Result<CallToolResult, McpError> {
        let limit = req.limit.unwrap_or(10);
        let results = self.kb_manager.search_similar(req.query, limit).await
            .map_err(|e| McpError::internal_error(e, None))?;
        todo!()
    }
}
```

Verify against your installed `rmcp` version's docs (syntax shifts across releases): the exact `ErrorData::internal_error(...)`/`McpError` constructor signature, and whether `CallToolResult` exposes `structured_content`.

**Done when:** all three tools resolve and return output matching the Phase 1 contract for the same inputs as the old server.

---

## Phase 4 — `ServerHandler::get_info`

```rust
fn get_info(&self) -> ServerInfo {
    ServerInfo {
        protocol_version: ProtocolVersion::V_2024_11_05, // or decide to wire config.protocol_version in — see note below
        capabilities: ServerCapabilities::builder().enable_tools().build(),
        server_info: Implementation {
            name: self.config.server_name.clone(),
            version: self.config.server_version.clone(),
            ..Default::default()
        },
        instructions: None,
    }
}
```

The old `config.protocol_version` (from CLI/env/file) was loaded but never actually used in the `initialize` response — it's dead. Drop it from `config.rs` now that you're simplifying, rather than carrying it forward unused.

Also drop `write_enabled`/`default_group_id` from `McpServerConfig` if nothing in the new 3-tool surface reads them (`default_group_id` was only used by `kb_get_project_graph`, which is gone). Keep `database_path`, `cache_dir`, `server_name`, `server_version` — still needed.

---

## Phase 5 — Swap the entrypoints

```rust
// mcp_server/mod.rs
pub fn run() -> Result<(), String> {
    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
    rt.block_on(async {
        let config = McpServerConfig::load()?;
        let kb_manager = build_state(&config)?; // existing db/cache-dir setup, untouched
        let service = KbMcpService::new(config, kb_manager);
        use rmcp::{transport::stdio, ServiceExt};
        let running = service.serve(stdio()).await.map_err(|e| e.to_string())?;
        running.waiting().await.map_err(|e| e.to_string())?;
        Ok(())
    })
}
```

`src-tauri/src/bin/*` and your existing MCP client config (`command`/`args`/`env`) need no changes — `run()`'s public signature is unchanged.

---

## Phase 6 — Delete the old hand-rolled implementation

Remove everything from `mod.rs` except config glue, `build_state`, and `run()`: delete `ServerState`, `JsonRpcError`, `ToolDefinition`, `TextContent`, `serve_stdio`, `handle_notification`, `handle_request`, `build_tool_list`, `handle_tool_call`, `ensure_writes_enabled`, and the manual JSON helpers.

**Done when:** `cargo check`/`cargo clippy` clean, no dead-code warnings.

---

## Phase 7 — Verify the crash bug is actually fixed

The original bug: any tool-call error, or any unrecognized notification, propagated via `?` out of the read loop and killed the whole process. `rmcp` tool handlers return `Result<CallToolResult, ErrorData>`, and the framework's internal loop — not your code — turns an `Err` into a wire-level error response without dropping the connection. Verify, don't assume:

1. Call `depdok_kb_search` with no `query`. Confirm the process stays alive and a *second*, valid request afterward still succeeds.
2. Send a notification method other than `notifications/initialized`. Confirm the server doesn't exit.
3. Grep the three ported tool bodies for `.unwrap()`/`.expect()`/indexing on anything derived from user input or DB state — these are panics, not `Result` errors, and `rmcp` can't save you from those. Replace with `?`/`Result` propagation.

Don't ship until both regression tests in steps 1–2 pass.

---

## Phase 8 — End-to-end manual verification

1. `npx @modelcontextprotocol/inspector <path-to-binary>` (set `DEPDOK_MCP_MODE=stdio` in its env panel) — confirm `initialize`, `tools/list` shows exactly the 3 tools, and each returns output matching the Phase 1 contract.
2. One real run through the packaged Tauri app using your existing client config, to rule out sidecar path issues separately from the protocol work above.

---

## Appendix — Adding a tool/domain later (not needed now)

If you ever want to bring back a dropped tool or add a new domain: new business-logic module (if it's a new domain) with zero `rmcp` imports, one new `mcp_server/tools/<name>.rs` adapter file, register it in `service.rs`. Nothing in `tools/knowledge_base.rs` needs to change for that.