use futures_util::StreamExt;
use rig::tool::PortableTool;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};

use super::pending::PendingRequests;
use super::tools::{
  AddMarkdownCommentTool, CreateFileTool, CreateFolderTool, DeleteFileOrFolderTool,
  GenerateContentTool, GetCurrentDatetimeTool, GetUserAgeTool, GetUserCountryTool,
  GetUserDobTool, GetUserNameTool, ListFilesTool, MoveFilesOrFoldersTool,
  ReadMarkdownTool, RenameFileTool, RenameFolderTool, RunShellTool,
  SearchKnowledgeBaseTool, SumFourDigitsTool, UpsertMarkdownSectionTool,
  UpsertMarkdownTool, WebSearchTool, FetchWebPageTool, WriteSkillTool,
  McpVerifyConfigTool, McpTestServerTool, McpListServersTool, McpReloadTool,
  SearchFileTool, ReloadSkillsTool,
  SheetReadTool, SheetGetDataTool, SheetGetCellTool, SheetCreateTool,
  SheetSetRangeDataTool, SheetEditCellTool, SheetClearRangeTool,
  SheetManageSheetTool, SheetModifyStructureTool, SheetFormatRangeTool,
  SheetExecuteCommandsTool,
};

pub const TOOL_MODEL: &str = "qwen2.5:7b";
pub const CONTENT_MODEL: &str = "gemma2:9b";
pub const NUM_CTX: usize = 16384;
pub const MAX_AGENT_TURNS: usize = 15;

pub fn build_system_prompt(tool_model: &str, content_model: &str) -> String {
  format!(
    r#"You are a helpful, precise, and capable AI desktop assistant for the Depdok document editor.
You operate in a Dual-Model Specialization architecture:
- You ({tool_model}) are the Tool & Orchestration Specialist: fast intent recognition, accurate tool calls, and structured workflow management.
- You have access to 'generate_content', which delegates long-form Markdown prose, creative writing, in-depth reports, tutorials, and editorial review to the Content Specialist ({content_model}).

IMPORTANT RULES:
- MULTI-STEP EXECUTION & TOOL FOLLOW-THROUGH:
  * When a user request requires multiple steps (e.g. creating a spreadsheet, populating table data, adding formulas, and applying cell styling or borders), you MUST continuously invoke the required tools step-by-step until ALL tasks are completely executed.
  * If a tool call fails or needs a different format, immediately invoke the next or corrected tool call in the same turn.
  * DO NOT output conversational filler text (e.g., 'Let me try again...', 'Now I will create...', 'I will set the data...') when you still have tools to call. Generating plain conversational text without tool calls terminates the execution prematurely.
- When asked questions about workspace documentation, project architecture, guides, previous notes, or concepts, invoke 'search_knowledge_base' to retrieve relevant sections and notes from the vector knowledge base before answering.
- When asked questions about external tools, setup guides, technologies, libraries, documentation, or up-to-date online information (e.g. 'how to setup claude code', 'latest Next.js release', 'bun vs node performance'), invoke 'web_search' to find relevant sources and links online.
- When the search results or snippets from 'web_search' require deeper details, installation steps, code examples, or when a specific URL is provided, invoke 'fetch_web_page' to read the full page content before answering.
- When answering from web research, synthesize a clear, comprehensive answer with code examples and cite source URLs cleanly (e.g. [Claude Code Docs](https://...)).
- When asked to run terminal / shell commands (e.g. 'git status', 'npm test', 'cargo check', scripts, CLI tools, or inspecting system info), invoke 'run_shell'.
- When asked to inspect, read, or summarize Excel/CSV spreadsheets, invoke 'sheet_read' (overview) or 'sheet_get_data' / 'sheet_get_cell' (data extraction).
- When asked to create, edit, or populate spreadsheets (.xlsx), invoke 'sheet_create' or 'sheet_set_range_data' / 'sheet_edit_cell'. Strings starting with '=' are treated as live formulas.
- When asked to style, format numbers, or apply borders to spreadsheet cells, invoke 'sheet_format_range'.
- When asked to manage sheets (tabs) or grid structure (rows/columns), invoke 'sheet_manage_sheet' or 'sheet_modify_structure'.
- When asked to draft, write, or expand rich markdown articles, tutorials, or deep reviews, invoke 'generate_content' to leverage {content_model}.
- When asked to review, inspect, or summarize an active markdown file, call 'read_markdown' first.
- When asked to add or update a section (e.g. 'Add Conclusion in test.md'), call 'upsert_markdown_section'.
- When asked to save, write, or record generated content, summaries, notes, or reviews to a file, always supply the complete markdown text in the 'content' parameter of 'create_file' or 'upsert_markdown'.
- When asked what files exist or to inspect folder structure, invoke 'list_files'.
- When asked to move, relocate, or cut/paste files, invoke 'move_files_or_folders'.
- When a user mentions a file using '@' (e.g. '@notes.md' or '@data.xlsx'), use that path in your tool calls.
- When a user mentions a folder or directory using '@' (e.g. '@src/components/' or '@docs/'), inspect its contents with 'list_files', or search its relevant notes with 'search_knowledge_base'.
- Once all tool results are provided, synthesize a clear, helpful final response with references or citations to source files/sections."#
  )
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaToolCall {
  pub function: OllamaFunctionCall,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaFunctionCall {
  pub name: String,
  pub arguments: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaMessage {
  pub role: String,
  pub content: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub tool_calls: Option<Vec<OllamaToolCall>>,
}

pub async fn prompt_agent(
  app: AppHandle,
  pending: PendingRequests,
  prompt: &str,
  model_name: Option<String>,
  content_model: Option<String>,
  message_id: Option<String>,
  initial_history: Option<Vec<OllamaMessage>>,
  num_ctx: Option<usize>,
  system_prompt_addendum: Option<String>,
  allowed_tools: Option<Vec<String>>,
  think: Option<bool>,
) -> Result<String, String> {
  let model_to_use = model_name
    .filter(|s| !s.trim().is_empty())
    .unwrap_or_else(|| TOOL_MODEL.to_string());
  let content_model_to_use = content_model
    .filter(|s| !s.trim().is_empty())
    .unwrap_or_else(|| CONTENT_MODEL.to_string());
  let num_ctx_to_use = num_ctx.unwrap_or(NUM_CTX);
  println!("[llm2][agent] Starting prompt with tool model '{}' (content model '{}', num_ctx {}): {:?}", model_to_use, content_model_to_use, num_ctx_to_use, prompt);

  let cancel_flag = match &message_id {
    Some(id) => pending.register_cancel(id),
    None => pending.register_cancel("default"),
  };

  let client = reqwest::Client::new();

  let sum_tool = SumFourDigitsTool { app: app.clone(), pending: pending.clone() };
  let user_name_tool = GetUserNameTool { app: app.clone(), pending: pending.clone() };
  let user_age_tool = GetUserAgeTool { app: app.clone(), pending: pending.clone() };
  let user_country_tool = GetUserCountryTool { app: app.clone(), pending: pending.clone() };
  let user_dob_tool = GetUserDobTool { app: app.clone(), pending: pending.clone() };

  let create_file_tool = CreateFileTool { app: app.clone(), pending: pending.clone() };
  let create_folder_tool = CreateFolderTool { app: app.clone(), pending: pending.clone() };
  let rename_file_tool = RenameFileTool { app: app.clone(), pending: pending.clone() };
  let rename_folder_tool = RenameFolderTool { app: app.clone(), pending: pending.clone() };
  let delete_tool = DeleteFileOrFolderTool { app: app.clone(), pending: pending.clone() };
  let move_tool = MoveFilesOrFoldersTool { app: app.clone(), pending: pending.clone() };
  let list_files_tool = ListFilesTool { app: app.clone(), pending: pending.clone() };
  let search_file_tool = SearchFileTool { app: app.clone(), pending: pending.clone() };

  let read_markdown_tool = ReadMarkdownTool { app: app.clone(), pending: pending.clone() };

  let upsert_markdown_tool = UpsertMarkdownTool { app: app.clone(), pending: pending.clone() };
  let upsert_markdown_section_tool = UpsertMarkdownSectionTool { app: app.clone(), pending: pending.clone() };
  let add_markdown_comment_tool = AddMarkdownCommentTool { app: app.clone(), pending: pending.clone() };
  let search_knowledge_base_tool = SearchKnowledgeBaseTool { app: app.clone(), pending: pending.clone() };
  let generate_content_tool = GenerateContentTool {
    app: app.clone(),
    default_content_model: Some(content_model_to_use.clone()),
  };
  let write_skill_tool = WriteSkillTool { app: app.clone(), pending: pending.clone() };
  let reload_skills_tool = ReloadSkillsTool { app: app.clone() };
  let datetime_tool = GetCurrentDatetimeTool { app: app.clone(), pending: pending.clone() };
  let shell_tool = RunShellTool { app: app.clone(), pending: pending.clone() };
  let web_search_tool = WebSearchTool { app: app.clone(), pending: pending.clone() };
  let fetch_web_page_tool = FetchWebPageTool { app: app.clone(), pending: pending.clone() };
  let mcp_verify_config_tool = McpVerifyConfigTool { app: app.clone() };
  let mcp_test_server_tool = McpTestServerTool { app: app.clone() };
  let mcp_list_servers_tool = McpListServersTool { app: app.clone() };
  let mcp_reload_tool = McpReloadTool { app: app.clone() };

  let sheet_read_tool = SheetReadTool { app: app.clone(), pending: pending.clone() };
  let sheet_get_data_tool = SheetGetDataTool { app: app.clone(), pending: pending.clone() };
  let sheet_get_cell_tool = SheetGetCellTool { app: app.clone(), pending: pending.clone() };
  let sheet_create_tool = SheetCreateTool { app: app.clone(), pending: pending.clone() };
  let sheet_set_range_data_tool = SheetSetRangeDataTool { app: app.clone(), pending: pending.clone() };
  let sheet_edit_cell_tool = SheetEditCellTool { app: app.clone(), pending: pending.clone() };
  let sheet_clear_range_tool = SheetClearRangeTool { app: app.clone(), pending: pending.clone() };
  let sheet_manage_sheet_tool = SheetManageSheetTool { app: app.clone(), pending: pending.clone() };
  let sheet_modify_structure_tool = SheetModifyStructureTool { app: app.clone(), pending: pending.clone() };
  let sheet_format_range_tool = SheetFormatRangeTool { app: app.clone(), pending: pending.clone() };
  let sheet_execute_commands_tool = SheetExecuteCommandsTool { app: app.clone(), pending: pending.clone() };

  let tools_schema = json!([
    {
      "type": "function",
      "function": {
        "name": "search_knowledge_base",
        "description": "Search the local workspace knowledge base and indexed documentation using semantic vector and keyword retrieval to find relevant notes, specifications, guides, and section contents.",
        "parameters": {
          "type": "object",
          "properties": {
            "query": { "type": "string", "description": "The search query, topic, or concept to look up across workspace notes and documents (e.g. 'authentication flow', 'markdown pagination', 'database schema')" },
            "limit": { "type": "integer", "description": "Maximum number of relevant sections to retrieve (default: 6)" }
          },
          "required": ["query"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "generate_content",
        "description": format!("Delegate long-form Markdown prose, creative writing, rich tutorials, or in-depth document generation to the Content Specialist model ({}).", content_model_to_use),
        "parameters": {
          "type": "object",
          "properties": {
            "topic": { "type": "string", "description": "The topic, instructions, or outline for the content to generate" },
            "style": { "type": "string", "description": "The tone or style (e.g. 'professional tutorial', 'engaging blog post', 'technical report')" },
            "language": { "type": "string", "description": "Target language (e.g. 'English', 'Vietnamese', 'Japanese')" },
            "content_model": { "type": "string", "description": format!("Optional specific content model name (defaults to '{}')", content_model_to_use) }
          },
          "required": ["topic"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "sum_four_digits",
        "description": "Calculate the sum of four numbers (a, b, c, d).",
        "parameters": {
          "type": "object",
          "properties": {
            "a": { "type": "number", "description": "First number" },
            "b": { "type": "number", "description": "Second number" },
            "c": { "type": "number", "description": "Third number" },
            "d": { "type": "number", "description": "Fourth number" }
          },
          "required": ["a", "b", "c", "d"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "get_user_name",
        "description": "Get the full name of a user by their user ID from the user database.",
        "parameters": {
          "type": "object",
          "properties": {
            "id": { "type": "integer", "description": "The numeric ID of the user" }
          },
          "required": ["id"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "get_user_age",
        "description": "Get the age of a specific user by their name from the user database.",
        "parameters": {
          "type": "object",
          "properties": {
            "name": { "type": "string", "description": "The full name of the user" }
          },
          "required": ["name"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "get_user_country",
        "description": "Get the country of residence / nationality of a specific user by their name.",
        "parameters": {
          "type": "object",
          "properties": {
            "name": { "type": "string", "description": "The full name of the user" }
          },
          "required": ["name"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "get_user_dob",
        "description": "Get the date of birth (DOB) of a specific user by their name in YYYY-MM-DD format.",
        "parameters": {
          "type": "object",
          "properties": {
            "name": { "type": "string", "description": "The full name of the user" }
          },
          "required": ["name"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "create_file",
        "description": "Create a new file in the workspace or specific path. Can optionally supply initial file content.",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string", "description": "The path or name of the file to create (e.g. 'notes.md' or 'src/utils.ts')" },
            "content": { "type": "string", "description": "Optional initial text content for the file" }
          },
          "required": ["path"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "create_folder",
        "description": "Create a new folder/directory in the workspace at the specified path.",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string", "description": "The path or name of the folder to create (e.g. 'docs' or 'src/components')" }
          },
          "required": ["path"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "rename_file",
        "description": "Rename a file in the workspace from old_path to new_name.",
        "parameters": {
          "type": "object",
          "properties": {
            "old_path": { "type": "string", "description": "The existing path or name of the file to rename" },
            "new_name": { "type": "string", "description": "The new name or new destination path for the file" }
          },
          "required": ["old_path", "new_name"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "rename_folder",
        "description": "Rename a folder/directory in the workspace from old_path to new_name.",
        "parameters": {
          "type": "object",
          "properties": {
            "old_path": { "type": "string", "description": "The existing path or name of the folder to rename" },
            "new_name": { "type": "string", "description": "The new name or new destination path for the folder" }
          },
          "required": ["old_path", "new_name"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "delete_file_or_folder",
        "description": "Delete a file or folder from the workspace by path.",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string", "description": "The path or name of the file or folder to delete" }
          },
          "required": ["path"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "move_files_or_folders",
        "description": "Move or cut one or more files and/or folders to a destination folder in the workspace.",
        "parameters": {
          "type": "object",
          "properties": {
            "paths": {
              "type": "array",
              "items": { "type": "string" },
              "description": "List of file or folder paths to move"
            },
            "destination_folder": {
              "type": "string",
              "description": "Target destination folder path (e.g. 'archive' or 'src/components')"
            }
          },
          "required": ["paths", "destination_folder"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "list_files",
        "description": "List or recursively traverse files and directories in the workspace or a specific folder. Returns file tree and relative paths.",
        "parameters": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "description": "Optional folder path to inspect (defaults to active workspace root if omitted)"
            },
            "recursive": {
              "type": "boolean",
              "description": "Whether to recursively list all subfolders (default false)"
            },
            "max_depth": {
              "type": "integer",
              "description": "Maximum depth for recursive traversal (default 4)"
            },
            "include_hidden": {
              "type": "boolean",
              "description": "Whether to include hidden or system files/folders (default false)"
            }
          }
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "search_file",
        "description": "Quickly search for files or folders across the workspace by filename, path, or keyword using high-performance fuzzy matching.",
        "parameters": {
          "type": "object",
          "properties": {
            "query": {
              "type": "string",
              "description": "The filename, path pattern, or keyword to search for (e.g. 'settings.json', 'index.ts', '.depdok', 'auth')"
            },
            "limit": {
              "type": "integer",
              "description": "Maximum number of matching files/folders to return (default: 20)"
            }
          },
          "required": ["query"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "read_markdown",

        "description": "Read the content of a Markdown file (or active open document if path omitted or set to 'active'). Returns document text, heading outline (# H1, ## H2), word count, and existing comments.",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string", "description": "The file path or name (e.g. 'notes.md' or 'docs/guide.md'). Omit or pass 'active' to read the currently active editor document." }
          }
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "upsert_markdown",
        "description": "Create, overwrite, or update the full content of a Markdown file (or active open document if path omitted or set to 'active').",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string", "description": "The file path or name. Omit or pass 'active' to update the active document." },
            "content": { "type": "string", "description": "The full markdown content to write to the file." }
          },
          "required": ["content"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "upsert_markdown_section",
        "description": "Update an existing section or add/append a new section to a Markdown file by section heading (e.g. 'Conclusion') or by replacing a target text snippet. If the heading does not exist, it will be automatically appended to the document.",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string", "description": "The file path or name. Omit or pass 'active' to target the active document." },
            "heading": { "type": "string", "description": "The heading title of the section to replace or add (e.g. 'Conclusion' or '## Introduction')." },
            "target_text": { "type": "string", "description": "Exact text snippet to locate and replace in the document." },
            "replacement_content": { "type": "string", "description": "The new replacement markdown content for the specified section or text snippet." }
          },
          "required": ["replacement_content"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "add_markdown_comment",
        "description": "Add an inline review comment to a specific text excerpt in a Markdown file. Wraps target text with comment mark and adds thread to comment sidebar drawer.",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string", "description": "The file path or name. Omit or pass 'active' to target the active document." },
            "target_text": { "type": "string", "description": "The exact text quote/snippet in the document to attach the review comment to." },
            "comment": { "type": "string", "description": "The review critique, suggestion, or comment feedback." },
            "author": { "type": "string", "description": "Optional author name for the comment (defaults to 'AI Assistant')." }
          },
          "required": ["target_text", "comment"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "write_skill",
        "description": "Write or update a project skill Markdown file in .depdok/skills/<name>.md. Content must include YAML frontmatter (name, description, tools) and markdown body instructions.",
        "parameters": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "description": "Optional skill name (must match ^[a-z0-9-]+$). If omitted, extracted from YAML frontmatter 'name' field."
            },
            "content": {
              "type": "string",
              "description": "The complete Markdown text of the skill, starting with '---' YAML frontmatter containing 'name', 'description', and optional 'tools' array, followed by '---' and the markdown body instructions."
            }
          },
          "required": ["content"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "get_current_datetime",
        "description": "Get the current system date, time, timezone, and formatted timestamp strings (such as 'yyyyMMdd-HHmm' for file naming, ISO 8601, dates, etc.).",
        "parameters": {
          "type": "object",
          "properties": {
            "format": {
              "type": "string",
              "description": "Optional custom format token string (e.g. 'yyyyMMdd-HHmm', 'yyyy-MM-dd', 'HH:mm:ss'). Defaults to 'yyyy-MM-dd HH:mm:ss'."
            }
          }
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "run_shell",
        "description": "Execute a shell / terminal command in the workspace directory across Windows, Linux, and macOS. Returns stdout, stderr, exit_code, and success status.",
        "parameters": {
          "type": "object",
          "properties": {
            "command": {
              "type": "string",
              "description": "The shell command line string to execute (e.g. 'git status', 'npm test', 'cargo check', 'ls -la', 'dir')."
            },
            "cwd": {
              "type": "string",
              "description": "Optional working directory relative to workspace root or absolute path. Defaults to the workspace root directory."
            },
            "timeout_ms": {
              "type": "number",
              "description": "Optional execution timeout in milliseconds (default 30000ms)."
            }
          },
          "required": ["command"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "web_search",
        "description": "Search the web for up-to-date information, facts, technical guides, documentation, APIs, and news. Returns top search results with titles, snippets, and URLs.",
        "parameters": {
          "type": "object",
          "properties": {
            "query": {
              "type": "string",
              "description": "The search query or keywords to search online (e.g. 'claude code setup guide', 'tauri v2 release notes', 'react 19 server actions')"
            },
            "limit": {
              "type": "integer",
              "description": "Maximum number of search results to return (default: 5, max: 10)"
            }
          },
          "required": ["query"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "fetch_web_page",
        "description": "Fetch and read the full readable text/markdown content of a webpage by URL. Strips navigation, ads, and scripts to return clean article/doc text.",
        "parameters": {
          "type": "object",
          "properties": {
            "url": {
              "type": "string",
              "description": "The full HTTP/HTTPS URL of the webpage to fetch and read (e.g. 'https://docs.anthropic.com/en/docs/...')"
            }
          },
          "required": ["url"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "mcp_verify_config",
        "description": "Verify and validate an MCP configuration snippet or existing .depdok/settings.json file. Checks JSON syntax, schema rules (command, args, env, url, headers), path validity, and Windows-specific command availability.",
        "parameters": {
          "type": "object",
          "properties": {
            "config_json": {
              "type": "string",
              "description": "Optional raw JSON string of the configuration (or 'mcpServers' object) to validate. If omitted, validates the workspace's active .depdok/settings.json."
            },
            "workspace_root": {
              "type": "string",
              "description": "Optional workspace root directory path. Defaults to the current active workspace."
            }
          }
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "mcp_test_server",
        "description": "Test connecting to an MCP server, completing the MCP handshake (initialize and tools/list), and discovering exposed tools. Captures detailed error messages and stderr if the connection fails.",
        "parameters": {
          "type": "object",
          "properties": {
            "server_name": {
              "type": "string",
              "description": "The name of the MCP server to test (from .depdok/settings.json or a custom name)."
            },
            "config_json": {
              "type": "string",
              "description": "Optional inline JSON string of the server config (e.g. '{\"command\": \"node\", \"args\": [\"./server.js\"]}') to test without saving first."
            },
            "workspace_root": {
              "type": "string",
              "description": "Optional workspace root directory path. Defaults to the current active workspace."
            }
          },
          "required": ["server_name"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "mcp_list_servers",
        "description": "List all currently configured and connected MCP servers in the app runtime, transport types, connection status ('connected', 'error', 'disconnected'), and discovered tool names.",
        "parameters": {
          "type": "object",
          "properties": {}
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "mcp_reload",
        "description": "Reload and reconnect all MCP servers configured in .depdok/settings.json (or .depdok/mcp.json) for the active workspace. Discovers updated tools and returns their statuses.",
        "parameters": {
          "type": "object",
          "properties": {
            "workspace_root": {
              "type": "string",
              "description": "Optional workspace root directory path. Defaults to the current active workspace."
            }
          }
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "reload_skills",
        "description": "Reload and rebuild the workspace AI skills cache from .depdok/skills/*.md. Returns the updated list of available skills and their declared tools.",
        "parameters": {
          "type": "object",
          "properties": {
            "workspace_root": {
              "type": "string",
              "description": "Optional workspace root directory path. Defaults to active workspace."
            }
          }
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "sheet_read",
        "description": "Inspect the metadata and overview of an Excel/CSV spreadsheet workbook. Returns sheet names, active tab, dimensions (rows/cols), cell count, and a 5x5 preview matrix for each sheet.",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string", "description": "The spreadsheet file path (e.g. 'budget.xlsx' or 'data.csv'). Omit or pass 'active' to inspect the currently open spreadsheet document." }
          }
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "sheet_get_data",
        "description": "Retrieve tabular data or a range from a spreadsheet. Can return data as a 2D matrix ('grid') or as an array of row JSON objects with column headers ('table').",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string", "description": "The spreadsheet file path (or omit/'active' for open document)." },
            "sheet": { "type": "string", "description": "Target sheet name (defaults to active sheet)." },
            "range": { "type": "string", "description": "Optional cell range bound (e.g. 'A1:E20'). Defaults to whole data range." },
            "format": { "type": "string", "enum": ["grid", "table"], "description": "Output format: 'grid' returns a 2D array [[val, ...], ...]; 'table' returns an array of row objects using the first row as column keys." }
          }
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "sheet_get_cell",
        "description": "Inspect a specific spreadsheet cell. Returns raw value, calculated formula value, formula expression ('=SUM(...)'), formatted text, number format pattern, and styles.",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string", "description": "The spreadsheet file path (or omit/'active' for open document)." },
            "sheet": { "type": "string", "description": "Target sheet name (defaults to active sheet)." },
            "cell": { "type": "string", "description": "Cell coordinate address (e.g. 'A1', 'C12', 'F4')." }
          },
          "required": ["cell"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "sheet_create",
        "description": "Create a new .xlsx spreadsheet workbook on disk with an initial sheet and optional 2D table data.",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string", "description": "The file path for the new spreadsheet (e.g. 'financial_report.xlsx')." },
            "sheet_name": { "type": "string", "description": "Initial sheet name (defaults to 'Sheet1')." },
            "initial_data": {
              "type": "array",
              "description": "Optional 2D array of initial rows and columns (e.g. [['Name', 'Amount'], ['Alice', 100]]).",
              "items": { "type": "array", "items": {} }
            }
          },
          "required": ["path"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "sheet_set_range_data",
        "description": "Bulk write a 2D matrix of values and formulas into a spreadsheet starting at a specific cell (e.g. start_cell 'A1'). Strings starting with '=' are evaluated as Excel formulas.",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string", "description": "The spreadsheet file path (or omit/'active' for open document)." },
            "sheet": { "type": "string", "description": "Target sheet name (defaults to active sheet)." },
            "start_cell": { "type": "string", "description": "Top-left cell coordinate to start writing data (e.g. 'A1', 'B5')." },
            "data": {
              "type": "array",
              "description": "2D array of rows and values/formulas (e.g. [['Item', 'Price', 'Total'], ['Widget', 25, '=B2*2']]).",
              "items": { "type": "array", "items": {} }
            }
          },
          "required": ["start_cell", "data"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "sheet_edit_cell",
        "description": "Set or update an individual cell's value or formula in a spreadsheet. Strings starting with '=' (e.g. '=SUM(A1:A10)') are treated as formulas.",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string", "description": "The spreadsheet file path (or omit/'active' for open document)." },
            "sheet": { "type": "string", "description": "Target sheet name (defaults to active sheet)." },
            "cell": { "type": "string", "description": "Cell coordinate address (e.g. 'B2', 'D10')." },
            "value": { "description": "The new value (string, number, boolean, or formula '=SUM(...)')." }
          },
          "required": ["cell", "value"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "sheet_clear_range",
        "description": "Clear cell values, formulas, or formatting styles in a given spreadsheet range (e.g. 'A1:C10').",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string", "description": "The spreadsheet file path (or omit/'active' for open document)." },
            "sheet": { "type": "string", "description": "Target sheet name (defaults to active sheet)." },
            "range": { "type": "string", "description": "Range address to clear (e.g. 'A2:D20')." },
            "clear_styles": { "type": "boolean", "description": "If true, also removes custom formatting, borders, and styles." }
          },
          "required": ["range"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "sheet_manage_sheet",
        "description": "Manage sheet tabs in a workbook (add, delete, rename, duplicate, or set active sheet).",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string", "description": "The spreadsheet file path (or omit/'active' for open document)." },
            "action": { "type": "string", "enum": ["add", "delete", "rename", "duplicate", "set_active"], "description": "The action to perform on sheet tabs." },
            "sheet_name": { "type": "string", "description": "Target sheet name for delete, duplicate, set_active, or the old name for rename." },
            "new_name": { "type": "string", "description": "The new sheet name (for 'add' or 'rename')." }
          },
          "required": ["action"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "sheet_modify_structure",
        "description": "Modify spreadsheet grid structure: insert or delete rows/columns, or configure column widths and row heights in pixels.",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string", "description": "The spreadsheet file path (or omit/'active' for open document)." },
            "sheet": { "type": "string", "description": "Target sheet name (defaults to active sheet)." },
            "action": { "type": "string", "enum": ["insert_row", "delete_row", "insert_col", "delete_col", "set_col_width", "set_row_height"], "description": "Grid structural operation to execute." },
            "index": { "type": "integer", "description": "0-indexed row or column number." },
            "size": { "type": "number", "description": "Dimension in pixels (required for 'set_col_width' or 'set_row_height')." }
          },
          "required": ["action", "index"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "sheet_format_range",
        "description": "Apply visual formatting to a spreadsheet cell range: text styles (bold, italic, color, bgColor, align), number formats ('$#,##0.00', '0.0%'), or borders.",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string", "description": "The spreadsheet file path (or omit/'active' for open document)." },
            "sheet": { "type": "string", "description": "Target sheet name (defaults to active sheet)." },
            "range": { "type": "string", "description": "Cell range to format (e.g. 'A1:D1', 'B2:B10')." },
            "style": { "type": "object", "description": "Styling properties: { bold?: bool, italic?: bool, color?: string, bgColor?: string, align?: 'left'|'center'|'right', fontSize?: number }." },
            "num_fmt": { "type": "string", "description": "Number format string (e.g. '$#,##0.00', '0.0%', 'YYYY-MM-DD', '@')." },
            "border": { "type": "object", "description": "Border settings: { borderType: 'all'|'outer'|'inner'|'top'|'bottom'|'left'|'right'|'none', color?: string, style?: 'thin'|'medium'|'thick'|'double' }." }
          },
          "required": ["range"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "sheet_execute_commands",
        "description": "Execute an atomic batch of low-level SpreadsheetCommand objects against a workbook.",
        "parameters": {
          "type": "object",
          "properties": {
            "path": { "type": "string", "description": "The spreadsheet file path (or omit/'active' for open document)." },
            "commands": { "type": "array", "description": "List of SpreadsheetCommand objects to execute in sequence.", "items": { "type": "object" } }
          },
          "required": ["commands"]
        }
      }
    }
  ]);

  let mcp_manager = app.try_state::<crate::mcp_client::McpClientManager>();
  let mut all_tools_vec = tools_schema.as_array().cloned().unwrap_or_default();
  if let Some(mgr) = &mcp_manager {
    let mcp_tools = mgr.get_ollama_tools().await;
    if !mcp_tools.is_empty() {
      println!("[llm2][agent] Injected {} external MCP tools into Ollama schema.", mcp_tools.len());
      all_tools_vec.extend(mcp_tools);
    }
  }
  let combined_tools_schema = json!(all_tools_vec);

  // Filter tools schema if allowed_tools is explicitly specified
  let effective_tools_schema: serde_json::Value = if let Some(allowed) = &allowed_tools {
    let filtered_list: Vec<serde_json::Value> = combined_tools_schema
      .as_array()
      .unwrap_or(&vec![])
      .iter()
      .filter(|tool_obj| {
        let fn_name = tool_obj
          .get("function")
          .and_then(|f| f.get("name"))
          .and_then(|n| n.as_str())
          .unwrap_or("");
        allowed.iter().any(|a| {
          a == fn_name
            || fn_name.starts_with(&format!("{a}__"))
            || a == "mcp"
            || a == "*"
        })
      })
      .cloned()
      .collect();
    json!(filtered_list)
  } else {
    combined_tools_schema
  };

  let mut system_content = build_system_prompt(&model_to_use, &content_model_to_use);

  if let Some(mgr) = &mcp_manager {
    let summaries = mgr.list_servers().await;
    let connected: Vec<_> = summaries
      .into_iter()
      .filter(|s| s.status == "connected" && s.tools_count > 0)
      .collect();
    if !connected.is_empty() {
      system_content.push_str("\n\n---\n## Connected MCP (Model Context Protocol) Servers & External Tools\n");
      system_content.push_str("The following external MCP servers are currently connected and active. You have full capability and permission to invoke their tools:\n");
      for s in connected {
        system_content.push_str(&format!(
          "- Server '{}' ({} tools): {}\n",
          s.name,
          s.tools_count,
          s.tools.join(", ")
        ));
      }
      system_content.push_str("When the user asks to query, perform actions on, or interact with any of these services, you MUST invoke the corresponding MCP tool function instead of stating that you cannot access them.\n");
    }
  }

  if let Some(addendum) = system_prompt_addendum {
    if !addendum.trim().is_empty() {
      system_content.push_str("\n\n---\n## Active Skill Instructions\n");
      system_content.push_str(addendum.trim());
    }
  }

  let mut history: Vec<OllamaMessage> = vec![
    OllamaMessage {
      role: "system".to_string(),
      content: system_content,
      tool_calls: None,
    },
  ];

  if let Some(prev_messages) = initial_history {
    for msg in prev_messages {
      if msg.role != "system" {
        history.push(msg);
      }
    }
  }

  history.push(OllamaMessage {
    role: "user".to_string(),
    content: prompt.to_string(),
    tool_calls: None,
  });

  let mut accumulated_final_text = String::new();

  let has_tools = effective_tools_schema
    .as_array()
    .map(|arr| !arr.is_empty())
    .unwrap_or(false);

  let tool_names: Vec<String> = if has_tools {
    effective_tools_schema
      .as_array()
      .map(|arr| {
        arr
          .iter()
          .filter_map(|t| t.get("function").and_then(|f| f.get("name")).and_then(|n| n.as_str()))
          .map(|s| s.to_string())
          .collect()
      })
      .unwrap_or_default()
  } else {
    Vec::new()
  };

  // Multi-turn streaming resolution loop (up to MAX_AGENT_TURNS iterations)
  for turn in 0..MAX_AGENT_TURNS {
    // Check if cancellation was requested before starting turn
    if cancel_flag.load(std::sync::atomic::Ordering::Relaxed) || pending.is_cancelled(message_id.as_deref()) {
      println!("[llm2][turn {}] 🛑 Generation cancelled by user.", turn);
      if let Some(msg_id) = &message_id {
        let _ = app.emit("llm2_done", json!({
          "message_id": msg_id,
          "content": accumulated_final_text,
          "cancelled": true,
        }));
        pending.remove_cancel(msg_id);
      }
      return Ok(accumulated_final_text);
    }

    let mut request_map = serde_json::Map::new();
    request_map.insert("model".to_string(), json!(model_to_use));
    request_map.insert("messages".to_string(), json!(history));
    if has_tools {
      request_map.insert("tools".to_string(), effective_tools_schema.clone());
    }
    request_map.insert("stream".to_string(), json!(true));
    let should_think = think.unwrap_or(true);
    request_map.insert("think".to_string(), json!(should_think));
    request_map.insert(
      "options".to_string(),
      json!({
        "num_ctx": num_ctx_to_use,
        "temperature": 0.2
      }),
    );
    let request_body = serde_json::Value::Object(request_map);

    println!("\n════════════════════ [llm2][turn {}] REQUEST TO OLLAMA ════════════════════", turn);
    println!("1. Model: {}", model_to_use);
    println!("2. Tools ({}): {}", tool_names.len(), tool_names.join(", "));
    if let Ok(pretty_messages) = serde_json::to_string_pretty(&history) {
      println!("3. Messages:\n{}", pretty_messages);
    } else {
      println!("3. Messages: {:?}", history);
    }
    println!("────────────────────────────────────────────────────────────────────────────");

    // Check if model is resident in Ollama RAM and notify frontend
    super::warmup::check_and_notify_model_status(
      &client,
      &app,
      &model_to_use,
      message_id.as_deref(),
      turn,
    )
    .await;

    println!("[llm2][turn {}] ⏳ Sending request to Ollama (http://localhost:11434/api/chat)...", turn);

    use std::io::Write;
    let req_start_time = std::time::Instant::now();

    let response = client
      .post("http://localhost:11434/api/chat")
      .json(&request_body)
      .send()
      .await
      .map_err(|e| format!("Failed to connect to Ollama (http://localhost:11434): {}", e))?;

    if !response.status().is_success() {
      let status = response.status();
      let err_text = response.text().await.unwrap_or_default();
      return Err(format!("Ollama HTTP {}: {}", status, err_text));
    }

    println!(
      "[llm2][turn {}] 📡 HTTP 200 received in {:.2}s. Awaiting stream chunks from Ollama...",
      turn,
      req_start_time.elapsed().as_secs_f64()
    );

    let mut stream = response.bytes_stream();
    let mut turn_text = String::new();
    let mut collected_tool_calls: Vec<OllamaToolCall> = Vec::new();
    let mut buffer = String::new();
    let mut first_chunk_received = false;
    let mut stream_token_count = 0usize;
    let mut thinking_token_count = 0usize;

    while let Some(chunk_res) = stream.next().await {
      if !first_chunk_received {
        first_chunk_received = true;
        if let Some(msg_id) = &message_id {
          let _ = app.emit("llm2_status", json!({
            "message_id": msg_id,
            "phase": "streaming",
            "model": model_to_use,
          }));
        }
      }
      if cancel_flag.load(std::sync::atomic::Ordering::Relaxed) || pending.is_cancelled(message_id.as_deref()) {
        println!("[llm2][turn {}] 🛑 Stream reading cancelled by user.", turn);
        if let Some(msg_id) = &message_id {
          let _ = app.emit("llm2_done", json!({
            "message_id": msg_id,
            "content": turn_text,
            "cancelled": true,
          }));
          pending.remove_cancel(msg_id);
        }
        return Ok(turn_text);
      }

      let chunk = chunk_res.map_err(|e| format!("Stream error: {}", e))?;
      let text = String::from_utf8_lossy(&chunk);
      buffer.push_str(&text);

      while let Some(pos) = buffer.find('\n') {
        let line = buffer[..pos].trim().to_string();
        buffer = buffer[pos + 1..].to_string();

        if line.is_empty() {
          continue;
        }

        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&line) {
          if !first_chunk_received {
            first_chunk_received = true;
            println!(
              "[llm2][turn {}] ⚡ First stream chunk received in {:.2}s. Streaming live output:",
              turn,
              req_start_time.elapsed().as_secs_f64()
            );
          }

          // Parse token metrics when stream chunk reports done
          if val.get("done").and_then(|d| d.as_bool()).unwrap_or(false) {
            let prompt_eval = val.get("prompt_eval_count").and_then(|v| v.as_u64()).unwrap_or(0);
            let eval = val.get("eval_count").and_then(|v| v.as_u64()).unwrap_or(0);
            println!(
              "\n[llm2][turn {}] 🏁 Stream done chunk. prompt_eval_count: {}, eval_count: {}, total_streamed_chunks: {}",
              turn, prompt_eval, eval, stream_token_count + thinking_token_count
            );
            if prompt_eval > 0 || eval > 0 {
              let total = prompt_eval + eval;
              let percent = (total as f64 / num_ctx_to_use as f64) * 100.0;
              if let Some(msg_id) = &message_id {
                let _ = app.emit("llm2_metrics", json!({
                  "message_id": msg_id,
                  "prompt_tokens": prompt_eval,
                  "completion_tokens": eval,
                  "total_tokens": total,
                  "num_ctx": num_ctx_to_use,
                  "percent_consumed": (percent * 10.0).round() / 10.0,
                  "remaining_tokens": num_ctx_to_use.saturating_sub(total as usize),
                }));
              }
            }
          }

          if let Some(msg) = val.get("message") {
            // Regular content delta
            if let Some(content) = msg.get("content").and_then(|c| c.as_str()) {
              if !content.is_empty() {
                stream_token_count += 1;
                print!("{}", content);
                std::io::stdout().flush().ok();

                turn_text.push_str(content);
                if let Some(msg_id) = &message_id {
                  let _ = app.emit("llm2_token", json!({
                    "message_id": msg_id,
                    "chunk": content,
                  }));
                }
              }
            }

            // Thinking delta (for reasoning models)
            if let Some(thinking) = msg.get("thinking").and_then(|t| t.as_str()) {
              if !thinking.is_empty() {
                thinking_token_count += 1;
                print!("{}", thinking);
                std::io::stdout().flush().ok();

                turn_text.push_str(thinking);
                if let Some(msg_id) = &message_id {
                  let _ = app.emit("llm2_thought", json!({
                    "message_id": msg_id,
                    "chunk": thinking,
                  }));
                }
              }
            }

            // Tool calls
            if let Some(tc_array) = msg.get("tool_calls").and_then(|t| t.as_array()) {
              for tc in tc_array {
                if let Ok(tool_call) = serde_json::from_value::<OllamaToolCall>(tc.clone()) {
                  println!(
                    "\n[llm2][turn {}] 🔧 Tool Call parsed in stream: {} with args: {:?}",
                    turn, tool_call.function.name, tool_call.function.arguments
                  );
                  collected_tool_calls.push(tool_call);
                }
              }
            }
          }
        }
      }
    }

    // Process any remaining bytes in buffer
    let remaining_line = buffer.trim();
    if !remaining_line.is_empty() {
      if let Ok(val) = serde_json::from_str::<serde_json::Value>(remaining_line) {
        if val.get("done").and_then(|d| d.as_bool()).unwrap_or(false) {
          let prompt_eval = val.get("prompt_eval_count").and_then(|v| v.as_u64()).unwrap_or(0);
          let eval = val.get("eval_count").and_then(|v| v.as_u64()).unwrap_or(0);
          if prompt_eval > 0 || eval > 0 {
            let total = prompt_eval + eval;
            let percent = (total as f64 / num_ctx_to_use as f64) * 100.0;
            if let Some(msg_id) = &message_id {
              let _ = app.emit("llm2_metrics", json!({
                "message_id": msg_id,
                "prompt_tokens": prompt_eval,
                "completion_tokens": eval,
                "total_tokens": total,
                "num_ctx": num_ctx_to_use,
                "percent_consumed": (percent * 10.0).round() / 10.0,
                "remaining_tokens": num_ctx_to_use.saturating_sub(total as usize),
              }));
            }
          }
        }

        if let Some(msg) = val.get("message") {
          if let Some(content) = msg.get("content").and_then(|c| c.as_str()) {
            if !content.is_empty() {
              stream_token_count += 1;
              print!("{}", content);
              std::io::stdout().flush().ok();

              turn_text.push_str(content);
              if let Some(msg_id) = &message_id {
                let _ = app.emit("llm2_token", json!({
                  "message_id": msg_id,
                  "chunk": content,
                }));
              }
            }
          }
          if let Some(thinking) = msg.get("thinking").and_then(|t| t.as_str()) {
            if !thinking.is_empty() {
              thinking_token_count += 1;
              print!("{}", thinking);
              std::io::stdout().flush().ok();

              turn_text.push_str(thinking);
              if let Some(msg_id) = &message_id {
                let _ = app.emit("llm2_thought", json!({
                  "message_id": msg_id,
                  "chunk": thinking,
                }));
              }
            }
          }
          if let Some(tc_array) = msg.get("tool_calls").and_then(|t| t.as_array()) {
            for tc in tc_array {
              if let Ok(tool_call) = serde_json::from_value::<OllamaToolCall>(tc.clone()) {
                println!(
                  "\n[llm2][turn {}] 🔧 Tool Call parsed in stream: {} with args: {:?}",
                  turn, tool_call.function.name, tool_call.function.arguments
                );
                collected_tool_calls.push(tool_call);
              }
            }
          }
        }
      }
    }

    println!("\n════════════════════ [llm2][turn {}] RESPONSE FROM OLLAMA ════════════════════", turn);
    println!(
      "Elapsed time: {:.2}s | Streamed chunks: {} (thinking: {}) | Text delta (len {}):\n{}",
      req_start_time.elapsed().as_secs_f64(),
      stream_token_count,
      thinking_token_count,
      turn_text.len(),
      if turn_text.is_empty() { "<empty>" } else { &turn_text }
    );
    if !collected_tool_calls.is_empty() {
      if let Ok(pretty_tc) = serde_json::to_string_pretty(&collected_tool_calls) {
        println!("Tool Calls (count {}):\n{}", collected_tool_calls.len(), pretty_tc);
      } else {
        println!("Tool Calls (count {}): {:?}", collected_tool_calls.len(), collected_tool_calls);
      }
    }
    println!("────────────────────────────────────────────────────────────────────────────");

    // If tools were called, execute them on React frontend and push results to history
    if !collected_tool_calls.is_empty() {
      // Push assistant message with tool calls
      history.push(OllamaMessage {
        role: "assistant".to_string(),
        content: turn_text.clone(),
        tool_calls: Some(collected_tool_calls.clone()),
      });

      // Execute each tool call
      for tool_call in collected_tool_calls {
        if cancel_flag.load(std::sync::atomic::Ordering::Relaxed) || pending.is_cancelled(message_id.as_deref()) {
          println!("[llm2] 🛑 Tool execution cancelled by user.");
          break;
        }

        let call_name = tool_call.function.name;
        let call_args = tool_call.function.arguments;
        println!("[llm2][tool_call] Executing '{}' with args: {:?}", call_name, call_args);

        let tool_execution_result: Result<serde_json::Value, String> = match call_name.as_str() {
          "generate_content" => {
            match serde_json::from_value(call_args) {
              Ok(args) => generate_content_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for generate_content: {}", e)),
            }
          }
          "get_user_name" => {
            match serde_json::from_value(call_args) {
              Ok(args) => user_name_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for get_user_name: {}", e)),
            }
          }
          "get_user_age" => {
            match serde_json::from_value(call_args) {
              Ok(args) => user_age_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for get_user_age: {}", e)),
            }
          }
          "get_user_country" => {
            match serde_json::from_value(call_args) {
              Ok(args) => user_country_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for get_user_country: {}", e)),
            }
          }
          "get_user_dob" => {
            match serde_json::from_value(call_args) {
              Ok(args) => user_dob_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for get_user_dob: {}", e)),
            }
          }
          "sum_four_digits" => {
            match serde_json::from_value(call_args) {
              Ok(args) => sum_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for sum_four_digits: {}", e)),
            }
          }
          "create_file" => {
            match serde_json::from_value(call_args) {
              Ok(args) => create_file_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for create_file: {}", e)),
            }
          }
          "create_folder" => {
            match serde_json::from_value(call_args) {
              Ok(args) => create_folder_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for create_folder: {}", e)),
            }
          }
          "rename_file" => {
            match serde_json::from_value(call_args) {
              Ok(args) => rename_file_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for rename_file: {}", e)),
            }
          }
          "rename_folder" => {
            match serde_json::from_value(call_args) {
              Ok(args) => rename_folder_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for rename_folder: {}", e)),
            }
          }
          "delete_file_or_folder" | "delete_node" => {
            match serde_json::from_value(call_args) {
              Ok(args) => delete_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for delete_file_or_folder: {}", e)),
            }
          }
          "move_files_or_folders" | "move_file_or_folder" | "move_files" | "cut_and_move" => {
            match serde_json::from_value(call_args) {
              Ok(args) => move_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for move_files_or_folders: {}", e)),
            }
          }
          "list_files" | "list_directory" | "traverse_directory" => {
            match serde_json::from_value(call_args) {
              Ok(args) => list_files_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for list_files: {}", e)),
            }
          }
          "search_file" | "search_files" | "fuzzy_search_files" => {
            match serde_json::from_value(call_args) {
              Ok(args) => search_file_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for search_file: {}", e)),
            }
          }
          "read_markdown" => {
            match serde_json::from_value(call_args) {
              Ok(args) => read_markdown_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for read_markdown: {}", e)),
            }
          }
          "upsert_markdown" | "update_markdown" => {
            match serde_json::from_value(call_args) {
              Ok(args) => upsert_markdown_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for upsert_markdown: {}", e)),
            }
          }
          "upsert_markdown_section" | "update_markdown_section" => {
            match serde_json::from_value(call_args) {
              Ok(args) => upsert_markdown_section_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for upsert_markdown_section: {}", e)),
            }
          }
          "add_markdown_comment" => {
            match serde_json::from_value(call_args) {
              Ok(args) => add_markdown_comment_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for add_markdown_comment: {}", e)),
            }
          }
          "search_knowledge_base" | "semantic_search" | "search_knowledge" => {
            match serde_json::from_value(call_args) {
              Ok(args) => search_knowledge_base_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for search_knowledge_base: {}", e)),
            }
          }
          "write_skill" => {
            match serde_json::from_value(call_args) {
              Ok(args) => write_skill_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for write_skill: {}", e)),
            }
          }
          "get_current_datetime" | "get_datetime" => {
            match serde_json::from_value(call_args) {
              Ok(args) => datetime_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for get_current_datetime: {}", e)),
            }
          }
          "run_shell" | "execute_shell" | "shell_command" | "exec_command" => {
            match serde_json::from_value(call_args) {
              Ok(args) => shell_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for run_shell: {}", e)),
            }
          }
          "web_search" | "search_web" | "internet_search" => {
            match serde_json::from_value(call_args) {
              Ok(args) => web_search_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for web_search: {}", e)),
            }
          }
          "fetch_web_page" | "read_web_page" | "fetch_url" | "read_url" => {
            match serde_json::from_value(call_args) {
              Ok(args) => fetch_web_page_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for fetch_web_page: {}", e)),
            }
          }
          "mcp_verify_config" | "mcp-verify-config" | "verify_mcp_config" => {
            match serde_json::from_value(call_args) {
              Ok(args) => mcp_verify_config_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for mcp_verify_config: {}", e)),
            }
          }
          "mcp_test_server" | "mcp-test-server" | "test_mcp_server" => {
            match serde_json::from_value(call_args) {
              Ok(args) => mcp_test_server_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for mcp_test_server: {}", e)),
            }
          }
          "mcp_list_servers" | "mcp-list-servers" | "list_mcp_servers" => {
            match serde_json::from_value(call_args) {
              Ok(args) => mcp_list_servers_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for mcp_list_servers: {}", e)),
            }
          }
          "mcp_reload" | "mcp-reload" | "reload_mcp" => {
            match serde_json::from_value(call_args) {
              Ok(args) => mcp_reload_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for mcp_reload: {}", e)),
            }
          }
          "reload_skills" | "skill_reload" | "reload-skills" => {
            match serde_json::from_value(call_args) {
              Ok(args) => reload_skills_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for reload_skills: {}", e)),
            }
          }
          "sheet_read" | "sheet_read_overview" | "read_spreadsheet" => {
            match serde_json::from_value(call_args) {
              Ok(args) => sheet_read_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for sheet_read: {}", e)),
            }
          }
          "sheet_get_data" | "sheet_read_data" | "get_spreadsheet_data" => {
            match serde_json::from_value(call_args) {
              Ok(args) => sheet_get_data_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for sheet_get_data: {}", e)),
            }
          }
          "sheet_get_cell" | "get_cell_value" => {
            match serde_json::from_value(call_args) {
              Ok(args) => sheet_get_cell_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for sheet_get_cell: {}", e)),
            }
          }
          "sheet_create" | "create_spreadsheet" => {
            match serde_json::from_value(call_args) {
              Ok(args) => sheet_create_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for sheet_create: {}", e)),
            }
          }
          "sheet_set_range_data" | "set_range_data" => {
            match serde_json::from_value(call_args) {
              Ok(args) => sheet_set_range_data_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for sheet_set_range_data: {}", e)),
            }
          }
          "sheet_edit_cell" | "edit_cell" | "set_cell_value" => {
            match serde_json::from_value(call_args) {
              Ok(args) => sheet_edit_cell_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for sheet_edit_cell: {}", e)),
            }
          }
          "sheet_clear_range" | "clear_range" => {
            match serde_json::from_value(call_args) {
              Ok(args) => sheet_clear_range_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for sheet_clear_range: {}", e)),
            }
          }
          "sheet_manage_sheet" | "manage_spreadsheet_sheet" => {
            match serde_json::from_value(call_args) {
              Ok(args) => sheet_manage_sheet_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for sheet_manage_sheet: {}", e)),
            }
          }
          "sheet_modify_structure" | "modify_spreadsheet_structure" => {
            match serde_json::from_value(call_args) {
              Ok(args) => sheet_modify_structure_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for sheet_modify_structure: {}", e)),
            }
          }
          "sheet_format_range" | "format_spreadsheet_range" => {
            match serde_json::from_value(call_args) {
              Ok(args) => sheet_format_range_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for sheet_format_range: {}", e)),
            }
          }
          "sheet_execute_commands" | "execute_spreadsheet_commands" => {
            match serde_json::from_value(call_args) {
              Ok(args) => sheet_execute_commands_tool.call(args).await.map_err(|e| e.to_string()),
              Err(e) => Err(format!("Invalid arguments for sheet_execute_commands: {}", e)),
            }
          }
          unknown => {
            let log_id = uuid::Uuid::new_v4().to_string();
            let req_id = uuid::Uuid::new_v4().to_string();

            // Emit executing event to frontend so tool card appears immediately
            let _ = app.emit("tool_log_event", json!({
              "id": log_id,
              "requestId": req_id,
              "toolName": unknown,
              "args": call_args,
              "status": "executing",
              "timestamp": chrono::Utc::now().to_rfc3339()
            }));

            if let Some(mgr) = &mcp_manager {
              if mgr.has_tool(unknown).await {
                match mgr.call_tool(unknown, call_args.clone()).await {
                  Ok(res) => {
                    let _ = app.emit("tool_log_event", json!({
                      "id": log_id,
                      "requestId": req_id,
                      "toolName": unknown,
                      "args": call_args,
                      "result": res,
                      "status": "success",
                      "timestamp": chrono::Utc::now().to_rfc3339()
                    }));
                    Ok(res)
                  }
                  Err(e) => {
                    let _ = app.emit("tool_log_event", json!({
                      "id": log_id,
                      "requestId": req_id,
                      "toolName": unknown,
                      "args": call_args,
                      "status": "error",
                      "error": e,
                      "timestamp": chrono::Utc::now().to_rfc3339()
                    }));
                    Err(e)
                  }
                }
              } else {
                let err_msg = format!("Unknown tool: {}", unknown);
                let _ = app.emit("tool_log_event", json!({
                  "id": log_id,
                  "requestId": req_id,
                  "toolName": unknown,
                  "args": call_args,
                  "status": "error",
                  "error": err_msg,
                  "timestamp": chrono::Utc::now().to_rfc3339()
                }));
                Err(err_msg)
              }
            } else {
              let err_msg = format!("Unknown tool: {}", unknown);
              let _ = app.emit("tool_log_event", json!({
                "id": log_id,
                "requestId": req_id,
                "toolName": unknown,
                "args": call_args,
                "status": "error",
                "error": err_msg,
                "timestamp": chrono::Utc::now().to_rfc3339()
              }));
              Err(err_msg)
            }
          }
        };

        let tool_result_value = match tool_execution_result {
          Ok(val) => {
            println!("[llm2][tool_result] Tool '{}' succeeded.", call_name);
            val
          }
          Err(err) => {
            println!("[llm2][tool_result] Tool '{}' failed with error: {}. Feeding error to model.", call_name, err);
            json!({ "error": err })
          }
        };

        // Push clean tool result into history for the next turn
        history.push(OllamaMessage {
          role: "tool".to_string(),
          content: serde_json::to_string(&tool_result_value).unwrap_or_default(),
          tool_calls: None,
        });
      }

      continue;
    }

    // Final text response reached
    accumulated_final_text = turn_text;
    break;
  }

  if let Some(msg_id) = &message_id {
    let _ = app.emit("llm2_done", json!({
      "message_id": msg_id,
      "content": accumulated_final_text,
    }));
    pending.remove_cancel(msg_id);
  }

  Ok(accumulated_final_text)
}
