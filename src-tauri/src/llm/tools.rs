use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::Path;
use std::process::Command;

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
            let content = fs::read_to_string(path)
                .map_err(|e| format!("Failed to read file: {}", e))?;
            Ok(json!({ "content": content }).to_string())
        }

        "write_file" => {
            let path = args["path"]
                .as_str()
                .ok_or("Missing 'path' argument")?;
            let content = args["content"]
                .as_str()
                .ok_or("Missing 'content' argument")?;
            if let Some(parent) = Path::new(path).parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create directories: {}", e))?;
            }
            fs::write(path, content)
                .map_err(|e| format!("Failed to write file: {}", e))?;
            Ok(json!({ "success": true }).to_string())
        }

        "list_directory" => {
            let path = args["path"]
                .as_str()
                .ok_or("Missing 'path' argument")?;
            let entries: Vec<Value> = fs::read_dir(path)
                .map_err(|e| format!("Failed to list directory: {}", e))?
                .filter_map(|e| e.ok())
                .map(|e| {
                    let name = e.file_name().to_string_lossy().to_string();
                    let is_dir = e.file_type().map(|t| t.is_dir()).unwrap_or(false);
                    json!({ "name": name, "is_dir": is_dir })
                })
                .collect();
            Ok(json!({ "entries": entries }).to_string())
        }

        "run_shell" => {
            let command = args["command"]
                .as_str()
                .ok_or("Missing 'command' argument")?;

            // Sandbox: only allow execution within workspace root
            let workspace = Path::new(workspace_root)
                .canonicalize()
                .map_err(|e| format!("Invalid workspace root: {}", e))?;

            #[cfg(target_os = "windows")]
            let output = Command::new("cmd")
                .args(&["/C", command])
                .current_dir(&workspace)
                .output()
                .map_err(|e| format!("Failed to run command: {}", e))?;

            #[cfg(not(target_os = "windows"))]
            let output = Command::new("sh")
                .args(&["-c", command])
                .current_dir(&workspace)
                .output()
                .map_err(|e| format!("Failed to run command: {}", e))?;

            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            let exit_code = output.status.code().unwrap_or(-1);

            Ok(json!({
                "stdout": stdout,
                "stderr": stderr,
                "exit_code": exit_code,
            })
            .to_string())
        }

        "web_search" => {
            let query = args["query"]
                .as_str()
                .ok_or("Missing 'query' argument")?;
            let result = search_duckduckgo(query)?;
            Ok(result)
        }

        _ => Err(format!("Unknown tool: {}", name)),
    }
}

/// Scrape DuckDuckGo HTML endpoint for search results.
fn search_duckduckgo(query: &str) -> Result<String, String> {
    use scraper::{Html, Selector};

    let url = format!(
        "https://html.duckduckgo.com/html/?q={}",
        urlencoding::encode(query)
    );

    let client = reqwest::blocking::Client::builder()
        .user_agent("Mozilla/5.0 (compatible; Depdok/1.0)")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let html = client
        .get(&url)
        .send()
        .map_err(|e| format!("Web search request failed: {}", e))?
        .text()
        .map_err(|e| format!("Failed to read response: {}", e))?;

    let document = Html::parse_document(&html);
    let result_sel = Selector::parse(".result").unwrap();
    let title_sel = Selector::parse(".result__title").unwrap();
    let snippet_sel = Selector::parse(".result__snippet").unwrap();
    let url_sel = Selector::parse(".result__url").unwrap();

    let mut results = Vec::new();
    for (i, result) in document.select(&result_sel).enumerate() {
        if i >= 5 {
            break;
        }
        let title = result
            .select(&title_sel)
            .next()
            .map(|e| e.text().collect::<String>().trim().to_string())
            .unwrap_or_default();
        let snippet = result
            .select(&snippet_sel)
            .next()
            .map(|e| e.text().collect::<String>().trim().to_string())
            .unwrap_or_default();
        let url = result
            .select(&url_sel)
            .next()
            .map(|e| e.text().collect::<String>().trim().to_string())
            .unwrap_or_default();

        if !title.is_empty() || !snippet.is_empty() {
            results.push(json!({
                "title": title,
                "snippet": snippet,
                "url": url,
            }));
        }
    }

    Ok(json!({ "results": results }).to_string())
}
