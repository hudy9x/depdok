use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

use super::config::McpServerConfig;
use super::transport::http::HttpTransport;
use super::transport::stdio::StdioTransport;
use super::transport::McpTransport;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpTool {
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "inputSchema", default)]
    pub input_schema: Value,
}

pub struct McpClient {
    server_name: String,
    transport: Arc<dyn McpTransport>,
}

impl McpClient {
    /// Create and connect a client from an McpServerConfig.
    pub async fn connect(server_name: &str, config: &McpServerConfig) -> Result<Self, String> {
        let transport: Arc<dyn McpTransport> = match config {
            McpServerConfig::Stdio {
                command,
                args,
                env,
                cwd,
            } => {
                let stdio_trans =
                    StdioTransport::spawn(server_name, command, args, env, cwd.as_ref()).await?;
                Arc::new(stdio_trans)
            }
            McpServerConfig::Http { url, headers } => {
                let http_trans = HttpTransport::connect(server_name, url, headers).await?;
                Arc::new(http_trans)
            }
        };

        let client = Self {
            server_name: server_name.to_string(),
            transport,
        };

        // Complete standard initialization handshake
        client.initialize().await?;

        Ok(client)
    }

    /// Perform Phase 1 standard MCP initialization handshake.
    pub async fn initialize(&self) -> Result<(), String> {
        let init_params = json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "roots": { "listChanged": false },
                "sampling": {}
            },
            "clientInfo": {
                "name": "Depdok",
                "version": env!("CARGO_PKG_VERSION")
            }
        });

        println!("[mcp_client][{}] Sending initialize...", self.server_name);
        let resp = self.transport.send_request("initialize", Some(init_params)).await?;
        println!("[mcp_client][{}] Initialize response: {:?}", self.server_name, resp);

        // Send notifications/initialized
        self.transport
            .send_notification("notifications/initialized", Some(json!({})))
            .await?;

        println!("[mcp_client][{}] Handshake initialized successfully.", self.server_name);
        Ok(())
    }

    /// Perform Phase 2 tool discovery (`tools/list`).
    pub async fn list_tools(&self) -> Result<Vec<McpTool>, String> {
        let resp = self.transport.send_request("tools/list", Some(json!({}))).await?;
        let mut tools = Vec::new();

        if let Some(tool_arr) = resp.get("tools").and_then(|t| t.as_array()) {
            for item in tool_arr {
                if let Ok(tool) = serde_json::from_value::<McpTool>(item.clone()) {
                    tools.push(tool);
                }
            }
        }

        Ok(tools)
    }

    /// Perform Phase 3 tool execution (`tools/call`).
    pub async fn call_tool(&self, name: &str, arguments: Value) -> Result<Value, String> {
        let call_params = json!({
            "name": name,
            "arguments": arguments
        });

        println!("[mcp_client][{}] Calling tool '{}' with params: {:?}", self.server_name, name, call_params);
        let resp = self.transport.send_request("tools/call", Some(call_params)).await?;
        Ok(resp)
    }

    /// Close the client transport.
    pub async fn close(&self) -> Result<(), String> {
        self.transport.close().await
    }
}
