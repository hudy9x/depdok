use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum McpServerConfig {
    Stdio {
        command: String,
        #[serde(default)]
        args: Vec<String>,
        #[serde(default)]
        env: HashMap<String, String>,
        #[serde(default)]
        cwd: Option<PathBuf>,
    },
    Http {
        url: String,
        #[serde(default)]
        headers: HashMap<String, String>,
    },
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct McpConfigFile {
    #[serde(rename = "mcpServers", default)]
    pub mcp_servers: HashMap<String, McpServerConfig>,
}

impl McpConfigFile {
    /// Load from a specific file path
    pub fn load_from_file(path: &Path) -> Result<Self, String> {
        if !path.exists() {
            return Ok(Self::default());
        }
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Failed to read MCP config at {}: {}", path.display(), e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse MCP config at {}: {}", path.display(), e))
    }

    /// Discover and load settings for a given workspace.
    /// Checks `.depdok/settings.json`, `.depdok/mcp.json`, and `.depdok/mcp_config.json`.
    pub fn load_for_workspace(workspace_root: &str) -> Self {
        let root = Path::new(workspace_root);
        let candidates = [
            root.join(".depdok").join("settings.json"),
            root.join(".depdok").join("mcp.json"),
            root.join(".depdok").join("mcp_config.json"),
        ];

        for path in &candidates {
            if path.exists() {
                if let Ok(config) = Self::load_from_file(path) {
                    if !config.mcp_servers.is_empty() {
                        println!("[mcp_client] Loaded {} MCP servers from {:?}", config.mcp_servers.len(), path);
                        return config;
                    }
                }
            }
        }

        Self::default()
    }
}
