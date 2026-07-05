// This file defines the public MCP tools (commands) exposed by the Depdok MCP server.
// Each tool is decorated with the `#[tool]` macro and routed via the `#[tool_router]` macro,
// allowing connected LLM clients (like Codex or Claude Desktop) to invoke them over stdio.

use rmcp::{handler::server::wrapper::Parameters, model::*, tool, tool_router, ErrorData as McpError};
use serde::Deserialize;
use serde_json::json;
use super::super::service::KbMcpService;

#[derive(Debug, Deserialize)]
pub struct SearchRequest {
    pub query: String,
    pub limit: Option<usize>,
}

impl schemars::JsonSchema for SearchRequest {
    fn schema_name() -> std::borrow::Cow<'static, str> {
        std::borrow::Cow::Borrowed("SearchRequest")
    }

    fn json_schema(_gen: &mut schemars::SchemaGenerator) -> schemars::Schema {
        serde_json::from_value(serde_json::json!({
            "type": "object",
            "properties": {
                "query": {
                    "type": "string"
                },
                "limit": {
                    "type": "integer",
                    "minimum": 1
                }
            },
            "required": ["query"],
            "additionalProperties": false
        })).unwrap()
    }
}

impl KbMcpService {
    pub fn kb_tool_router() -> rmcp::handler::server::router::tool::ToolRouter<KbMcpService> {
        Self::tool_router()
    }
}

#[tool_router]
impl KbMcpService {
    #[tool(description = "Return SQLite version, database path, and record counts for the knowledge base.")]
    async fn kb_get_status(&self) -> Result<CallToolResult, McpError> {
        let conn = self.kb_manager.db_lock();
        let conn = conn.lock().await;

        let sqlite_version: String = conn
            .query_row("SELECT sqlite_version()", [], |row| row.get(0))
            .map_err(|e| McpError::internal_error(format!("Failed to read sqlite version: {e}"), None))?;

        let db_path: String = conn
            .query_row(
                "SELECT file FROM pragma_database_list WHERE name = 'main'",
                [],
                |row| row.get(0),
            )
            .map_err(|e| McpError::internal_error(format!("Failed to resolve database path: {e}"), None))?;

        let documents_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM documents", [], |row| row.get(0))
            .map_err(|e| McpError::internal_error(format!("Failed to count documents: {e}"), None))?;

        let edges_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM edges", [], |row| row.get(0))
            .map_err(|e| McpError::internal_error(format!("Failed to count edges: {e}"), None))?;

        let embeddings_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM documents_embeddings", [], |row| row.get(0))
            .map_err(|e| McpError::internal_error(format!("Failed to count embeddings: {e}"), None))?;

        let status = json!({
            "sqlite_version": sqlite_version,
            "db_path": db_path,
            "documents_count": documents_count,
            "edges_count": edges_count,
            "embeddings_count": embeddings_count,
        });

        let pretty_status = serde_json::to_string_pretty(&status)
            .map_err(|e| McpError::internal_error(e.to_string(), None))?;

        Ok(CallToolResult {
            content: vec![Content::text(pretty_status)],
            is_error: Some(false),
            meta: None,
            structured_content: Some(status),
        })
    }

    #[tool(description = "Search the knowledge base using hybrid keyword (FTS5) + semantic (vector) search.")]
    async fn kb_search(&self, Parameters(req): Parameters<SearchRequest>) -> Result<CallToolResult, McpError> {
        let limit = req.limit.unwrap_or(10);
        let results = self.kb_manager.search_hybrid(req.query, limit).await
            .map_err(|e| McpError::internal_error(e, None))?;

        let pretty_results = serde_json::to_string_pretty(&results)
            .map_err(|e| McpError::internal_error(e.to_string(), None))?;

        let structured = json!({ "results": results });

        Ok(CallToolResult {
            content: vec![Content::text(pretty_results)],
            is_error: Some(false),
            meta: None,
            structured_content: Some(structured),
        })
    }

    #[tool(description = "Search the knowledge base for semantically similar documents.")]
    async fn kb_search_similar(&self, Parameters(req): Parameters<SearchRequest>) -> Result<CallToolResult, McpError> {
        let limit = req.limit.unwrap_or(10);
        let results = self.kb_manager.search_similar(req.query, limit).await
            .map_err(|e| McpError::internal_error(e, None))?;

        let pretty_results = serde_json::to_string_pretty(&results)
            .map_err(|e| McpError::internal_error(e.to_string(), None))?;

        let structured = json!({ "results": results });

        Ok(CallToolResult {
            content: vec![Content::text(pretty_results)],
            is_error: Some(false),
            meta: None,
            structured_content: Some(structured),
        })
    }
}
