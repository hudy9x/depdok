mod config;

use std::io::{self, BufRead, Write};
use std::path::Path;

use serde::Serialize;
use serde_json::{json, Map, Value};
use rusqlite::params;

use crate::knowledge_base::db::init_database_at_path;
use crate::knowledge_base::embedding;
use crate::knowledge_base::manager::KbManager;

pub use config::McpServerConfig;

const SUPPORTED_PROTOCOL_VERSION: &str = "2024-11-05";

#[derive(Serialize)]
struct JsonRpcError<'a> {
    code: i64,
    message: &'a str,
}

struct ServerState {
    config: McpServerConfig,
    kb_manager: KbManager,
}

#[derive(Serialize)]
struct ToolDefinition {
    name: &'static str,
    description: &'static str,
    #[serde(rename = "inputSchema")]
    input_schema: Value,
}

#[derive(Serialize)]
struct TextContent<'a> {
    #[serde(rename = "type")]
    kind: &'a str,
    text: &'a str,
}

pub fn run() -> Result<(), String> {
    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
    rt.block_on(async {
        let config = McpServerConfig::load()?;
        let state = build_state(config)?;
        serve_stdio(state).await
    })
}

fn build_state(config: McpServerConfig) -> Result<ServerState, String> {
    if let Some(parent) = config.database_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create MCP database directory: {e}"))?;
    }

    std::fs::create_dir_all(&config.cache_dir)
        .map_err(|e| format!("Failed to create MCP cache directory: {e}"))?;

    let embedder = embedding::init_embedder(Some(config.cache_dir.clone()))?;
    let dims = embedder.dimensions();
    let conn = init_database_at_path(Path::new(&config.database_path), dims)?;
    let kb_manager = KbManager::new(conn, embedder);

    Ok(ServerState {
        config,
        kb_manager,
    })
}

async fn serve_stdio(state: ServerState) -> Result<(), String> {
    let stdin = io::stdin();
    let mut stdout = io::stdout();
    let mut reader = stdin.lock();
    let mut buffer = String::new();

    loop {
        buffer.clear();
        let read = reader
            .read_line(&mut buffer)
            .map_err(|e| format!("Failed to read MCP request: {e}"))?;

        if read == 0 {
            break;
        }

        let trimmed = buffer.trim();
        if trimmed.is_empty() {
            continue;
        }

        let value: Value = match serde_json::from_str(trimmed) {
            Ok(value) => value,
            Err(err) => {
                write_json(
                    &mut stdout,
                    json!({
                        "jsonrpc": "2.0",
                        "id": Value::Null,
                        "error": JsonRpcError { code: -32700, message: &format!("Parse error: {err}") },
                    }),
                )?;
                continue;
            }
        };

        if value.get("id").is_none() {
            handle_notification(&state, &value)?;
            continue;
        }

        let response = handle_request(&state, &value).await;
        write_json(&mut stdout, response?)?;
    }

    Ok(())
}

fn handle_notification(_state: &ServerState, value: &Value) -> Result<(), String> {
    match value.get("method").and_then(Value::as_str) {
        Some("notifications/initialized") => Ok(()),
        Some(method) => Err(format!("Unsupported notification method: {method}")),
        None => Err("Notification is missing method".to_string()),
    }
}

async fn handle_request(state: &ServerState, value: &Value) -> Result<Value, String> {
    let id = value.get("id").cloned().unwrap_or(Value::Null);
    let method = value
        .get("method")
        .and_then(Value::as_str)
        .ok_or_else(|| "Request missing method".to_string())?;

    let response = match method {
        "initialize" => json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {
                "protocolVersion": SUPPORTED_PROTOCOL_VERSION,
                "serverInfo": {
                    "name": state.config.server_name.clone(),
                    "version": state.config.server_version.clone(),
                },
                "capabilities": {
                    "tools": {}
                }
            }
        }),
        "tools/list" => json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {
                "tools": build_tool_list(state.config.write_enabled)
            }
        }),
        "tools/call" => {
            let params = value.get("params").cloned().unwrap_or(Value::Null);
            let result = handle_tool_call(state, params).await?;
            json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": result
            })
        }
        "ping" => json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {}
        }),
        "shutdown" => json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": null
        }),
        _ => return Ok(json_rpc_error(id, -32601, "Method not found")),
    };

    Ok(response)
}

fn build_tool_list(write_enabled: bool) -> Vec<ToolDefinition> {
    let mut tools = vec![
        ToolDefinition {
            name: "kb_get_status",
            description: "Return SQLite version, database path, and record counts for the knowledge base.",
            input_schema: json!({"type": "object", "properties": {}, "additionalProperties": false}),
        },
        ToolDefinition {
            name: "kb_search_similar",
            description: "Search the knowledge base for semantically similar documents.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "limit": {"type": "integer", "minimum": 1, "default": 10}
                },
                "required": ["query"],
                "additionalProperties": false
            }),
        },
        ToolDefinition {
            name: "kb_search_hybrid",
            description: "Search the knowledge base using a hybrid keyword (FTS5) + semantic (vector) query.",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "limit": {"type": "integer", "minimum": 1, "default": 10}
                },
                "required": ["query"],
                "additionalProperties": false
            }),
        },
        ToolDefinition {
            name: "kb_get_chunk_context",
            description: "Fetch a matched chunk's surrounding context window (preceding/succeeding sibling chunks).",
            input_schema: json!({
                "type": "object",
                "properties": {
                    "chunkId": {"type": "string"},
                    "window": {"type": "integer", "minimum": 1, "default": 2}
                },
                "required": ["chunkId"],
                "additionalProperties": false
            }),
        },
        ToolDefinition {
            name: "kb_get_document",
            description: "Fetch a single document by id.",
            input_schema: json!({
                "type": "object",
                "properties": {"id": {"type": "string"}},
                "required": ["id"],
                "additionalProperties": false
            }),
        },
        ToolDefinition {
            name: "kb_get_project_graph",
            description: "Return the documents and edges for a project group.",
            input_schema: json!({
                "type": "object",
                "properties": {"groupId": {"type": "string"}},
                "additionalProperties": false
            }),
        },
    ];

    if write_enabled {
        tools.extend([
            ToolDefinition {
                name: "kb_connect_documents",
                description: "Create a directed edge between two documents.",
                input_schema: json!({
                    "type": "object",
                    "properties": {
                        "sourceId": {"type": "string"},
                        "targetId": {"type": "string"},
                        "edgeType": {"type": ["string", "null"]}
                    },
                    "required": ["sourceId", "targetId"],
                    "additionalProperties": false
                }),
            },
            ToolDefinition {
                name: "kb_delete_document",
                description: "Delete a document, its embeddings, and any cascading edges.",
                input_schema: json!({
                    "type": "object",
                    "properties": {"id": {"type": "string"}},
                    "required": ["id"],
                    "additionalProperties": false
                }),
            },
        ]);
    }

    tools
}

async fn handle_tool_call(state: &ServerState, params: Value) -> Result<Value, String> {
    let name = params
        .get("name")
        .and_then(Value::as_str)
        .ok_or_else(|| "Tool call missing name".to_string())?;
    let arguments = params.get("arguments").cloned().unwrap_or(Value::Object(Map::new()));

    match name {
        "kb_get_status" => {
            let conn = state.kb_manager.db_lock();
            let conn = conn.lock().await;

            let sqlite_version: String = conn
                .query_row("SELECT sqlite_version()", [], |row| row.get(0))
                .map_err(|e| format!("Failed to read sqlite version: {e}"))?;

            let db_path: String = conn
                .query_row(
                    "SELECT file FROM pragma_database_list WHERE name = 'main'",
                    [],
                    |row| row.get(0),
                )
                .map_err(|e| format!("Failed to resolve database path: {e}"))?;

            let documents_count: i64 = conn
                .query_row("SELECT COUNT(*) FROM documents", [], |row| row.get(0))
                .map_err(|e| format!("Failed to count documents: {e}"))?;

            let edges_count: i64 = conn
                .query_row("SELECT COUNT(*) FROM edges", [], |row| row.get(0))
                .map_err(|e| format!("Failed to count edges: {e}"))?;

            let embeddings_count: i64 = conn
                .query_row("SELECT COUNT(*) FROM documents_embeddings", [], |row| row.get(0))
                .map_err(|e| format!("Failed to count embeddings: {e}"))?;

            let status = json!({
                "sqlite_version": sqlite_version,
                "db_path": db_path,
                "documents_count": documents_count,
                "edges_count": edges_count,
                "embeddings_count": embeddings_count,
            });

            Ok(json!({
                "content": [text_content(&serde_json::to_string_pretty(&status).map_err(|e| e.to_string())?)],
                "structuredContent": status,
            }))
        }
        "kb_search_similar" => {
            let query = required_string(&arguments, "query")?;
            let limit = optional_usize(&arguments, "limit").unwrap_or(10);
            let results = state.kb_manager.search_similar(query, limit).await?;
            Ok(json!({
                "content": [text_content(&serde_json::to_string_pretty(&results).map_err(|e| e.to_string())?)],
                "structuredContent": results,
            }))
        }
        "kb_search_hybrid" => {
            let query = required_string(&arguments, "query")?;
            let limit = optional_usize(&arguments, "limit").unwrap_or(10);
            let results = state.kb_manager.search_hybrid(query, limit).await?;
            Ok(json!({
                "content": [text_content(&serde_json::to_string_pretty(&results).map_err(|e| e.to_string())?)],
                "structuredContent": results,
            }))
        }
        "kb_get_chunk_context" => {
            let chunk_id = required_string(&arguments, "chunkId")?;
            let window = optional_usize(&arguments, "window").unwrap_or(2);
            let results = state.kb_manager.get_chunk_context(chunk_id, window).await?;
            Ok(json!({
                "content": [text_content(&serde_json::to_string_pretty(&results).map_err(|e| e.to_string())?)],
                "structuredContent": results,
            }))
        }
        "kb_get_document" => {
            let id = required_string(&arguments, "id")?;
            let document = state.kb_manager.get_document(id).await?;
            Ok(json!({
                "content": [text_content(&serde_json::to_string_pretty(&document).map_err(|e| e.to_string())?)],
                "structuredContent": document,
            }))
        }
        "kb_get_project_graph" => {
            let group_id = optional_string(&arguments, "groupId")
                .unwrap_or_else(|| state.config.default_group_id.clone());
            let graph = state.kb_manager.get_project_graph(group_id).await?;
            Ok(json!({
                "content": [text_content(&serde_json::to_string_pretty(&graph).map_err(|e| e.to_string())?)],
                "structuredContent": graph,
            }))
        }
        "kb_connect_documents" => {
            ensure_writes_enabled(state)?;
            let source_id = required_string(&arguments, "sourceId")?;
            let target_id = required_string(&arguments, "targetId")?;
            let edge_type = optional_string(&arguments, "edgeType");
            
            let edge_id = uuid::Uuid::new_v4().to_string();
            let conn = state.kb_manager.db_lock();
            let conn = conn.lock().await;

            let target_exists: bool = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM documents WHERE id = ?1)",
                params![target_id],
                |row| row.get(0),
            ).unwrap_or(false);

            if !target_exists {
                return Err("Target document does not exist".to_string());
            }

            conn.execute(
                "INSERT INTO edges (id, source_id, target_id, type) VALUES (?1, ?2, ?3, ?4)",
                params![edge_id, source_id, target_id, edge_type],
            )
            .map_err(|e| format!("Failed to insert edge: {e}"))?;

            let edge_id_text = edge_id.clone();

            Ok(json!({
                "content": [text_content(&edge_id_text)],
                "structuredContent": {"id": edge_id},
            }))
        }
        "kb_delete_document" => {
            ensure_writes_enabled(state)?;
            let id = required_string(&arguments, "id")?;
            state.kb_manager.delete_document(id).await?;
            Ok(json!({
                "content": [text_content("ok")],
                "structuredContent": {"deleted": true},
            }))
        }
        _ => Err(format!("Unsupported tool: {name}")),
    }
}

fn ensure_writes_enabled(state: &ServerState) -> Result<(), String> {
    if state.config.write_enabled {
        Ok(())
    } else {
        Err("Write tools are disabled by configuration".to_string())
    }
}

fn required_string(arguments: &Value, key: &str) -> Result<String, String> {
    optional_string(arguments, key).ok_or_else(|| format!("Missing required argument: {key}"))
}

fn optional_string(arguments: &Value, key: &str) -> Option<String> {
    arguments
        .get(key)
        .and_then(Value::as_str)
        .map(|value| value.to_string())
}

fn optional_usize(arguments: &Value, key: &str) -> Option<usize> {
    arguments.get(key).and_then(Value::as_u64).map(|value| value as usize)
}

fn text_content(text: &str) -> TextContent<'_> {
    TextContent { kind: "text", text }
}

fn json_rpc_error(id: Value, code: i64, message: &str) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "error": JsonRpcError { code, message },
    })
}

fn write_json(stdout: &mut impl Write, value: Value) -> Result<(), String> {
    serde_json::to_writer(&mut *stdout, &value)
        .map_err(|e| format!("Failed to serialise MCP response: {e}"))?;
    stdout
        .write_all(b"\n")
        .map_err(|e| format!("Failed to write MCP response: {e}"))?;
    stdout
        .flush()
        .map_err(|e| format!("Failed to flush MCP response: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    #[test]
    fn read_only_tool_list_omits_writes() {
        let tools = build_tool_list(false);
        let names: BTreeMap<_, _> = tools.into_iter().map(|tool| (tool.name, tool.description)).collect();

        assert!(names.contains_key("kb_get_status"));
        assert!(names.contains_key("kb_search_similar"));
        assert!(names.contains_key("kb_get_document"));
        assert!(names.contains_key("kb_get_project_graph"));
        assert!(!names.contains_key("kb_delete_document"));
    }

    #[test]
    fn writable_tool_list_includes_write_tools() {
        let tools = build_tool_list(true);
        let names: BTreeMap<_, _> = tools.into_iter().map(|tool| (tool.name, tool.description)).collect();

        assert!(names.contains_key("kb_connect_documents"));
        assert!(names.contains_key("kb_delete_document"));
        assert!(!names.contains_key("kb_upsert_document"));
        assert!(!names.contains_key("kb_index_markdown_document_sections"));
    }
}