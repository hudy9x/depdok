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

impl McpServerConfig {
    /// Normalize paths, commands, environment variables, and CWD relative to the workspace root.
    pub fn normalize_for_workspace(&mut self, workspace_root: &str) {
        if workspace_root.trim().is_empty() {
            return;
        }
        let ws_path = Path::new(workspace_root);

        match self {
            McpServerConfig::Stdio {
                command,
                args,
                env,
                cwd,
            } => {
                // 1. Resolve and default CWD to workspace root
                let resolved_cwd = match cwd {
                    Some(dir) => {
                        if dir.is_relative() {
                            ws_path.join(&dir)
                        } else {
                            dir.clone()
                        }
                    }
                    None => ws_path.to_path_buf(),
                };
                *cwd = Some(resolved_cwd);

                // 2. Normalize Command (${workspaceFolder}, relative paths, Windows .cmd binaries)
                *command = command
                    .replace("${workspaceFolder}", workspace_root)
                    .replace("${workspaceRoot}", workspace_root);

                if command.starts_with("./") || command.starts_with(".\\") {
                    let rel = command.trim_start_matches("./").trim_start_matches(".\\");
                    *command = ws_path.join(rel).to_string_lossy().to_string();
                } else if Path::new(&command).is_relative()
                    && (command.contains('/') || command.contains('\\'))
                {
                    *command = ws_path.join(&command).to_string_lossy().to_string();
                }

                #[cfg(target_os = "windows")]
                {
                    let cmd_lower = command.to_lowercase();
                    if cmd_lower == "npx" {
                        *command = "npx.cmd".to_string();
                    } else if cmd_lower == "npm" {
                        *command = "npm.cmd".to_string();
                    } else if cmd_lower == "pnpm" {
                        *command = "pnpm.cmd".to_string();
                    } else if cmd_lower == "yarn" {
                        *command = "yarn.cmd".to_string();
                    }

                    // Normalize slashes for Windows absolute paths like E:/foo/bar
                    if command.len() >= 2
                        && command.chars().next().map_or(false, |c| c.is_ascii_alphabetic())
                        && command.chars().nth(1) == Some(':')
                    {
                        *command = command.replace('/', "\\");
                    }
                }

                // 3. Normalize Args (${workspaceFolder}, relative ./ and Windows drive paths)
                for arg in args.iter_mut() {
                    *arg = arg
                        .replace("${workspaceFolder}", workspace_root)
                        .replace("${workspaceRoot}", workspace_root);

                    if arg.starts_with("./") || arg.starts_with(".\\") {
                        let rel = arg.trim_start_matches("./").trim_start_matches(".\\");
                        let resolved = ws_path.join(rel);
                        #[cfg(target_os = "windows")]
                        {
                            *arg = resolved.to_string_lossy().replace('/', "\\");
                        }
                        #[cfg(not(target_os = "windows"))]
                        {
                            *arg = resolved.to_string_lossy().to_string();
                        }
                    } else {
                        #[cfg(target_os = "windows")]
                        {
                            if arg.len() >= 2
                                && arg.chars().next().map_or(false, |c| c.is_ascii_alphabetic())
                                && arg.chars().nth(1) == Some(':')
                            {
                                *arg = arg.replace('/', "\\");
                            }
                        }
                    }
                }

                // 4. Normalize Env
                for val in env.values_mut() {
                    *val = val
                        .replace("${workspaceFolder}", workspace_root)
                        .replace("${workspaceRoot}", workspace_root);
                }
            }
            McpServerConfig::Http { .. } => {}
        }
    }
}

impl McpConfigFile {
    /// Normalize all configured servers for the given workspace.
    pub fn normalize_for_workspace(&mut self, workspace_root: &str) {
        for srv in self.mcp_servers.values_mut() {
            srv.normalize_for_workspace(workspace_root);
        }
    }

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
                if let Ok(mut config) = Self::load_from_file(path) {
                    if !config.mcp_servers.is_empty() {
                        config.normalize_for_workspace(workspace_root);
                        println!(
                            "[mcp_client] Loaded and normalized {} MCP servers from {:?}",
                            config.mcp_servers.len(),
                            path
                        );
                        return config;
                    }
                }
            }
        }

        Self::default()
    }

    /// Verify a configuration and check for validity, missing files, or path issues.
    pub fn verify(
        config_opt: Option<&str>,
        workspace_root: &str,
    ) -> serde_json::Value {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();

        let mut config_file = if let Some(raw) = config_opt {
            let trimmed = raw.trim();
            if let Ok(file) = serde_json::from_str::<McpConfigFile>(trimmed) {
                file
            } else if let Ok(server_cfg) = serde_json::from_str::<super::config::McpServerConfig>(trimmed) {
                let mut map = HashMap::new();
                map.insert("custom_server".to_string(), server_cfg);
                McpConfigFile { mcp_servers: map }
            } else if let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) {
                if let Some(obj) = val.get("mcpServers") {
                    serde_json::from_value(serde_json::json!({ "mcpServers": obj }))
                        .unwrap_or_default()
                } else {
                    errors.push("Invalid JSON format. Expected root 'mcpServers' object or server configuration.".to_string());
                    McpConfigFile::default()
                }
            } else {
                errors.push("Failed to parse JSON string.".to_string());
                McpConfigFile::default()
            }
        } else {
            McpConfigFile::load_for_workspace(workspace_root)
        };

        if config_file.mcp_servers.is_empty() && errors.is_empty() {
            warnings.push("No MCP servers found in configuration.".to_string());
        }

        for (name, srv) in &mut config_file.mcp_servers {
            srv.normalize_for_workspace(workspace_root);

            match srv {
                super::config::McpServerConfig::Stdio {
                    command,
                    args,
                    cwd,
                    ..
                } => {
                    if command.trim().is_empty() {
                        errors.push(format!("[{}] 'command' cannot be empty.", name));
                    }

                    // Check if command is a relative/absolute path file and whether it exists
                    let cmd_path = Path::new(command);
                    if cmd_path.is_absolute() || command.contains('/') || command.contains('\\') {
                        if !cmd_path.exists() {
                            warnings.push(format!(
                                "[{}] Command path '{}' does not currently exist on disk.",
                                name, command
                            ));
                        }
                    }

                    // Check args for file existence
                    for arg in args {
                        let arg_path = Path::new(arg);
                        if arg_path.is_absolute() {
                            if !arg_path.exists()
                                && (arg.ends_with(".js")
                                    || arg.ends_with(".ts")
                                    || arg.ends_with(".py")
                                    || arg.ends_with(".json")
                                    || arg.ends_with(".exe")
                                    || arg.ends_with(".bat"))
                            {
                                warnings.push(format!(
                                    "[{}] Referenced file in args '{}' does not currently exist.",
                                    name, arg
                                ));
                            }
                        }
                    }

                    if let Some(dir) = cwd {
                        if !dir.exists() {
                            warnings.push(format!(
                                "[{}] CWD directory '{}' does not exist.",
                                name,
                                dir.display()
                            ));
                        }
                    }
                }
                super::config::McpServerConfig::Http { url, .. } => {
                    if !url.starts_with("http://") && !url.starts_with("https://") {
                        errors.push(format!(
                            "[{}] HTTP url must start with http:// or https://",
                            name
                        ));
                    }
                }
            }
        }

        let is_valid = errors.is_empty();
        serde_json::json!({
            "valid": is_valid,
            "servers_count": config_file.mcp_servers.len(),
            "errors": errors,
            "warnings": warnings,
            "normalized_config": config_file
        })
    }
}
