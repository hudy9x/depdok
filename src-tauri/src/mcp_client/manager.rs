use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use super::client::McpClient;
use super::config::McpConfigFile;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerSummary {
    pub name: String,
    pub transport_type: String,
    pub status: String,
    pub tools_count: usize,
    pub tools: Vec<String>,
    pub error: Option<String>,
}

#[derive(Clone)]
pub struct McpClientManager {
    // Map: server_name -> McpClient
    clients: Arc<RwLock<HashMap<String, Arc<McpClient>>>>,
    // Map: exposed_tool_name -> (server_name, original_tool_name, McpClient)
    tool_routing: Arc<RwLock<HashMap<String, (String, String, Arc<McpClient>)>>>,
    // Cached Ollama tools array
    ollama_tools_schema: Arc<RwLock<Vec<Value>>>,
    // Status summary for UI/diagnostics
    summaries: Arc<RwLock<Vec<McpServerSummary>>>,
}

impl Default for McpClientManager {
    fn default() -> Self {
        Self::new()
    }
}

impl McpClientManager {
    pub fn new() -> Self {
        Self {
            clients: Arc::new(RwLock::new(HashMap::new())),
            tool_routing: Arc::new(RwLock::new(HashMap::new())),
            ollama_tools_schema: Arc::new(RwLock::new(Vec::new())),
            summaries: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Reload all MCP servers configured in the workspace (`.depdok/settings.json`, etc.).
    pub async fn reload_for_workspace(&self, workspace_root: &str) -> Result<Vec<McpServerSummary>, String> {
        println!("[mcp_client] Reloading MCP servers for workspace: {}", workspace_root);
        
        // 1. Close existing connections
        {
            let mut clients_guard = self.clients.write().await;
            for (name, client) in clients_guard.drain() {
                println!("[mcp_client] Closing existing client '{}'", name);
                let _ = client.close().await;
            }
        }

        // 2. Load configuration file
        let config_file = McpConfigFile::load_for_workspace(workspace_root);
        let mut new_clients = HashMap::new();
        let mut new_tool_routing = HashMap::new();
        let mut new_ollama_tools = Vec::new();
        let mut new_summaries = Vec::new();

        for (server_name, server_cfg) in config_file.mcp_servers {
            let transport_type = match &server_cfg {
                super::config::McpServerConfig::Stdio { .. } => "stdio".to_string(),
                super::config::McpServerConfig::Http { .. } => "http".to_string(),
            };

            match McpClient::connect(&server_name, &server_cfg).await {
                Ok(client) => {
                    let client_arc = Arc::new(client);
                    match client_arc.list_tools().await {
                        Ok(tools) => {
                            let tool_names: Vec<String> = tools.iter().map(|t| t.name.clone()).collect();
                            println!("[mcp_client] Discovered {} tools from '{}': {:?}", tools.len(), server_name, tool_names);

                            for tool in tools {
                                // Expose as scoped name: `server__tool_name`
                                let scoped_name = format!("{}__{}", server_name, tool.name);
                                new_tool_routing.insert(
                                    scoped_name.clone(),
                                    (server_name.clone(), tool.name.clone(), Arc::clone(&client_arc)),
                                );

                                // Also expose under direct name if no conflict
                                if !new_tool_routing.contains_key(&tool.name) {
                                    new_tool_routing.insert(
                                        tool.name.clone(),
                                        (server_name.clone(), tool.name.clone(), Arc::clone(&client_arc)),
                                    );
                                }

                                // Construct Ollama tool schema
                                let desc = tool.description.unwrap_or_else(|| format!("MCP tool from {}", server_name));
                                new_ollama_tools.push(json!({
                                    "type": "function",
                                    "function": {
                                        "name": scoped_name,
                                        "description": format!("[MCP: {}] {}", server_name, desc),
                                        "parameters": if tool.input_schema.is_object() { tool.input_schema } else { json!({ "type": "object", "properties": {} }) }
                                    }
                                }));
                            }

                            new_summaries.push(McpServerSummary {
                                name: server_name.clone(),
                                transport_type,
                                status: "connected".to_string(),
                                tools_count: tool_names.len(),
                                tools: tool_names,
                                error: None,
                            });

                            new_clients.insert(server_name, client_arc);
                        }
                        Err(e) => {
                            eprintln!("[mcp_client] Failed to list tools for '{}': {}", server_name, e);
                            new_summaries.push(McpServerSummary {
                                name: server_name,
                                transport_type,
                                status: "error".to_string(),
                                tools_count: 0,
                                tools: Vec::new(),
                                error: Some(format!("Failed to list tools: {}", e)),
                            });
                        }
                    }
                }
                Err(e) => {
                    eprintln!("[mcp_client] Failed to connect to server '{}': {}", server_name, e);
                    new_summaries.push(McpServerSummary {
                        name: server_name,
                        transport_type,
                        status: "error".to_string(),
                        tools_count: 0,
                        tools: Vec::new(),
                        error: Some(e),
                    });
                }
            }
        }

        // 3. Atomically update state
        {
            let mut clients_guard = self.clients.write().await;
            *clients_guard = new_clients;

            let mut routing_guard = self.tool_routing.write().await;
            *routing_guard = new_tool_routing;

            let mut schema_guard = self.ollama_tools_schema.write().await;
            *schema_guard = new_ollama_tools;

            let mut sum_guard = self.summaries.write().await;
            *sum_guard = new_summaries.clone();
        }

        Ok(new_summaries)
    }

    /// Get the cached list of Ollama tools schema.
    pub async fn get_ollama_tools(&self) -> Vec<Value> {
        self.ollama_tools_schema.read().await.clone()
    }

    /// Check if a tool name is registered in any active MCP server.
    pub async fn has_tool(&self, name: &str) -> bool {
        self.tool_routing.read().await.contains_key(name)
    }

    /// Dispatch a tool execution to the appropriate MCP server.
    pub async fn call_tool(&self, name: &str, arguments: Value) -> Result<Value, String> {
        let route = {
            let routing_guard = self.tool_routing.read().await;
            routing_guard.get(name).cloned()
        };

        if let Some((server_name, original_name, client)) = route {
            println!("[mcp_client] Dispatching tool '{}' (target: '{}.{}')", name, server_name, original_name);
            client.call_tool(&original_name, arguments).await
        } else {
            Err(format!("No MCP server found for tool '{}'", name))
        }
    }

    /// Get current server summaries.
    pub async fn list_servers(&self) -> Vec<McpServerSummary> {
        self.summaries.read().await.clone()
    }

    /// Shutdown all servers gracefully.
    pub async fn shutdown(&self) {
        let mut clients_guard = self.clients.write().await;
        for (name, client) in clients_guard.drain() {
            let _ = client.close().await;
            println!("[mcp_client] Server '{}' closed.", name);
        }
    }
}
