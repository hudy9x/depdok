use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

pub mod fs;
pub mod shell;
pub mod yahoo;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters: Value,
}

/// Returns the standard tool definitions sent to every LLM provider.
pub fn get_tool_definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "read_file".to_string(),
            description: "Read the contents of a file at the given path.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Absolute path to the file to read."
                    }
                },
                "required": ["path"]
            }),
        },
        ToolDefinition {
            name: "write_file".to_string(),
            description: "Write content to a file at the given path. Creates the file if it doesn't exist.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Absolute path to the file to write."
                    },
                    "content": {
                        "type": "string",
                        "description": "Content to write to the file."
                    }
                },
                "required": ["path", "content"]
            }),
        },
        ToolDefinition {
            name: "list_directory".to_string(),
            description: "List files and directories at the given path.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Absolute path to the directory to list."
                    }
                },
                "required": ["path"]
            }),
        },
        ToolDefinition {
            name: "run_shell".to_string(),
            description: "Run a shell command. The command is sandboxed to the workspace root directory. Commands that would execute outside the workspace are rejected.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "Shell command to execute."
                    }
                },
                "required": ["command"]
            }),
        },
        ToolDefinition {
            name: "web_search".to_string(),
            description: "Search the web using DuckDuckGo. Returns top result snippets and URLs.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query string."
                    }
                },
                "required": ["query"]
            }),
        },
    ]
}

/// Execute a tool call given its name and arguments.
/// Returns a JSON string result or an error string.
pub fn execute_tool(
    name: &str,
    args: &Value,
    workspace_root: &str,
) -> Result<String, String> {
    match name {
        "read_file" => {
            let path = args["path"]
                .as_str()
                .ok_or("Missing 'path' argument")?;
            fs::read_file(path)
        }

        "write_file" => {
            let path = args["path"]
                .as_str()
                .ok_or("Missing 'path' argument")?;
            let content = args["content"]
                .as_str()
                .ok_or("Missing 'content' argument")?;
            fs::write_file(path, content)
        }

        "list_directory" => {
            let path = args["path"]
                .as_str()
                .ok_or("Missing 'path' argument")?;
            fs::list_directory(path)
        }

        "run_shell" => {
            let command = args["command"]
                .as_str()
                .ok_or("Missing 'command' argument")?;
            shell::run_shell(command, workspace_root)
        }

        "web_search" => {
            let query = args["query"]
                .as_str()
                .ok_or("Missing 'query' argument")?;
            yahoo::search_yahoo(query)
        }

        _ => Err(format!("Unknown tool: {}", name)),
    }
}
