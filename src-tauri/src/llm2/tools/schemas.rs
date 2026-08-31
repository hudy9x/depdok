use serde_json::json;

/// Builds the comprehensive list of built-in Ollama function tool schemas.
pub fn get_builtin_tools_schema(content_model_to_use: &str) -> serde_json::Value {
  json!([
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
  ])
}

/// Filters the combined tool schemas if `allowed_tools` is explicitly provided.
pub fn filter_tools_schema(
  combined_schema: serde_json::Value,
  allowed_tools: Option<&Vec<String>>,
) -> serde_json::Value {
  if let Some(allowed) = allowed_tools {
    let filtered: Vec<serde_json::Value> = combined_schema
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
    json!(filtered)
  } else {
    combined_schema
  }
}
