use futures_util::StreamExt;
use rig::tool::PortableTool;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};

use super::pending::PendingRequests;
use super::tools::{
  AddMarkdownCommentArgs, AddMarkdownCommentTool, CreateFileArgs, CreateFileTool,
  CreateFolderArgs, CreateFolderTool, DeleteFileOrFolderArgs, DeleteFileOrFolderTool,
  GenerateContentArgs, GenerateContentTool, GetUserAgeArgs, GetUserAgeTool,
  GetUserCountryArgs, GetUserCountryTool, GetUserDobArgs, GetUserDobTool,
  GetUserNameArgs, GetUserNameTool, ListFilesArgs, ListFilesTool,
  MoveFilesOrFoldersArgs, MoveFilesOrFoldersTool, ReadMarkdownArgs, ReadMarkdownTool,
  RenameFileArgs, RenameFileTool, RenameFolderArgs, RenameFolderTool,
  SearchKnowledgeBaseArgs, SearchKnowledgeBaseTool, SumFourDigitsArgs,
  SumFourDigitsTool, UpsertMarkdownArgs, UpsertMarkdownSectionArgs,
  UpsertMarkdownSectionTool, UpsertMarkdownTool, WriteSkillArgs, WriteSkillTool,
  GetCurrentDatetimeArgs, GetCurrentDatetimeTool, RunShellArgs, RunShellTool,
};

pub const TOOL_MODEL: &str = "qwen2.5:7b";
pub const CONTENT_MODEL: &str = "gemma2:9b";
pub const NUM_CTX: usize = 16384;

const SYSTEM_PROMPT: &str = "\
You are a helpful, precise, and capable AI desktop assistant for the Depdok document editor.
You operate in a Dual-Model Specialization architecture:
- You (qwen2.5:7b) are the Tool & Orchestration Specialist: fast intent recognition, accurate tool calls, and structured workflow management.
- You have access to 'generate_content', which delegates long-form Markdown prose, creative writing, in-depth reports, tutorials, and editorial review to the Content Specialist (gemma2:9b).

IMPORTANT RULES:
- When asked questions about workspace documentation, project architecture, guides, previous notes, or concepts, invoke 'search_knowledge_base' to retrieve relevant sections and notes from the vector knowledge base before answering.
- When asked to run terminal / shell commands (e.g. 'git status', 'npm test', 'cargo check', scripts, CLI tools, or inspecting system info), invoke 'run_shell'.
- When asked to draft, write, or expand rich markdown articles, tutorials, or deep reviews, invoke 'generate_content' to leverage gemma2:9b.
- When asked to review, inspect, or summarize an active markdown file, call 'read_markdown' first.
- When asked to add or update a section (e.g. 'Add Conclusion in test.md'), call 'upsert_markdown_section'.
- When asked to save, write, or record generated content, summaries, notes, or reviews to a file, always supply the complete markdown text in the 'content' parameter of 'create_file' or 'upsert_markdown'.
- When asked what files exist or to inspect folder structure, invoke 'list_files'.
- When asked to move, relocate, or cut/paste files, invoke 'move_files_or_folders'.
- When a user mentions a file using '@' (e.g. '@notes.md' or '@docs/guide.md'), use that path in your tool calls.
- Once all tool results are provided, synthesize a clear, helpful final response with references or citations to source files/sections.";



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
  message_id: Option<String>,
  initial_history: Option<Vec<OllamaMessage>>,
  num_ctx: Option<usize>,
  system_prompt_addendum: Option<String>,
  allowed_tools: Option<Vec<String>>,
) -> Result<String, String> {
  let model_to_use = model_name
    .filter(|s| !s.trim().is_empty())
    .unwrap_or_else(|| TOOL_MODEL.to_string());
  let num_ctx_to_use = num_ctx.unwrap_or(NUM_CTX);
  println!("[llm2][agent] Starting prompt with tool model '{}' (content model '{}', num_ctx {}): {:?}", model_to_use, CONTENT_MODEL, num_ctx_to_use, prompt);

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

  let read_markdown_tool = ReadMarkdownTool { app: app.clone(), pending: pending.clone() };

  let upsert_markdown_tool = UpsertMarkdownTool { app: app.clone(), pending: pending.clone() };
  let upsert_markdown_section_tool = UpsertMarkdownSectionTool { app: app.clone(), pending: pending.clone() };
  let add_markdown_comment_tool = AddMarkdownCommentTool { app: app.clone(), pending: pending.clone() };
  let search_knowledge_base_tool = SearchKnowledgeBaseTool { app: app.clone(), pending: pending.clone() };
  let generate_content_tool = GenerateContentTool { app: app.clone() };
  let write_skill_tool = WriteSkillTool { app: app.clone(), pending: pending.clone() };
  let datetime_tool = GetCurrentDatetimeTool { app: app.clone(), pending: pending.clone() };
  let shell_tool = RunShellTool { app: app.clone(), pending: pending.clone() };

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
        "description": "Delegate long-form Markdown prose, creative writing, rich tutorials, or in-depth document generation to the Content Specialist model (gemma2:9b).",
        "parameters": {
          "type": "object",
          "properties": {
            "topic": { "type": "string", "description": "The topic, instructions, or outline for the content to generate" },
            "style": { "type": "string", "description": "The tone or style (e.g. 'professional tutorial', 'engaging blog post', 'technical report')" },
            "language": { "type": "string", "description": "Target language (e.g. 'English', 'Vietnamese', 'Japanese')" },
            "content_model": { "type": "string", "description": "Optional specific content model name (defaults to 'gemma2:9b')" }
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
        allowed.iter().any(|a| a == fn_name)
      })
      .cloned()
      .collect();
    json!(filtered_list)
  } else {
    combined_tools_schema
  };

  let mut system_content = SYSTEM_PROMPT.to_string();
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

  // Multi-turn streaming resolution loop
  for turn in 0..6 {
    let mut request_map = serde_json::Map::new();
    request_map.insert("model".to_string(), json!(model_to_use));
    request_map.insert("messages".to_string(), json!(history));
    if has_tools {
      request_map.insert("tools".to_string(), effective_tools_schema.clone());
    }
    request_map.insert("stream".to_string(), json!(true));
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
                  let _ = app.emit("llm2_token", json!({
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
                let _ = app.emit("llm2_token", json!({
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
        let call_name = tool_call.function.name;
        let call_args = tool_call.function.arguments;
        println!("[llm2][tool_call] Executing '{}' with args: {:?}", call_name, call_args);

        let tool_result_value = match call_name.as_str() {
          "generate_content" => {
            let args: GenerateContentArgs = serde_json::from_value(call_args)
              .map_err(|e| e.to_string())?;
            generate_content_tool.call(args).await.map_err(|e| e.to_string())?
          }
          "get_user_name" => {
            let args: GetUserNameArgs = serde_json::from_value(call_args)
              .map_err(|e| e.to_string())?;
            user_name_tool.call(args).await.map_err(|e| e.to_string())?
          }
          "get_user_age" => {
            let args: GetUserAgeArgs = serde_json::from_value(call_args)
              .map_err(|e| e.to_string())?;
            user_age_tool.call(args).await.map_err(|e| e.to_string())?
          }
          "get_user_country" => {
            let args: GetUserCountryArgs = serde_json::from_value(call_args)
              .map_err(|e| e.to_string())?;
            user_country_tool.call(args).await.map_err(|e| e.to_string())?
          }
          "get_user_dob" => {
            let args: GetUserDobArgs = serde_json::from_value(call_args)
              .map_err(|e| e.to_string())?;
            user_dob_tool.call(args).await.map_err(|e| e.to_string())?
          }
          "sum_four_digits" => {
            let args: SumFourDigitsArgs = serde_json::from_value(call_args)
              .map_err(|e| e.to_string())?;
            sum_tool.call(args).await.map_err(|e| e.to_string())?
          }
          "create_file" => {
            let args: CreateFileArgs = serde_json::from_value(call_args)
              .map_err(|e| e.to_string())?;
            create_file_tool.call(args).await.map_err(|e| e.to_string())?
          }
          "create_folder" => {
            let args: CreateFolderArgs = serde_json::from_value(call_args)
              .map_err(|e| e.to_string())?;
            create_folder_tool.call(args).await.map_err(|e| e.to_string())?
          }
          "rename_file" => {
            let args: RenameFileArgs = serde_json::from_value(call_args)
              .map_err(|e| e.to_string())?;
            rename_file_tool.call(args).await.map_err(|e| e.to_string())?
          }
          "rename_folder" => {
            let args: RenameFolderArgs = serde_json::from_value(call_args)
              .map_err(|e| e.to_string())?;
            rename_folder_tool.call(args).await.map_err(|e| e.to_string())?
          }
          "delete_file_or_folder" | "delete_node" => {
            let args: DeleteFileOrFolderArgs = serde_json::from_value(call_args)
              .map_err(|e| e.to_string())?;
            delete_tool.call(args).await.map_err(|e| e.to_string())?
          }
          "move_files_or_folders" | "move_file_or_folder" | "move_files" | "cut_and_move" => {
            let args: MoveFilesOrFoldersArgs = serde_json::from_value(call_args)
              .map_err(|e| e.to_string())?;
            move_tool.call(args).await.map_err(|e| e.to_string())?
          }
          "list_files" | "list_directory" | "traverse_directory" => {
            let args: ListFilesArgs = serde_json::from_value(call_args)
              .map_err(|e| e.to_string())?;
            list_files_tool.call(args).await.map_err(|e| e.to_string())?
          }
          "read_markdown" => {

            let args: ReadMarkdownArgs = serde_json::from_value(call_args)
              .map_err(|e| e.to_string())?;
            read_markdown_tool.call(args).await.map_err(|e| e.to_string())?
          }
          "upsert_markdown" | "update_markdown" => {
            let args: UpsertMarkdownArgs = serde_json::from_value(call_args)
              .map_err(|e| e.to_string())?;
            upsert_markdown_tool.call(args).await.map_err(|e| e.to_string())?
          }
          "upsert_markdown_section" | "update_markdown_section" => {
            let args: UpsertMarkdownSectionArgs = serde_json::from_value(call_args)
              .map_err(|e| e.to_string())?;
            upsert_markdown_section_tool.call(args).await.map_err(|e| e.to_string())?
          }
          "add_markdown_comment" => {
            let args: AddMarkdownCommentArgs = serde_json::from_value(call_args)
              .map_err(|e| e.to_string())?;
            add_markdown_comment_tool.call(args).await.map_err(|e| e.to_string())?
          }
          "search_knowledge_base" | "semantic_search" | "search_knowledge" => {
            let args: SearchKnowledgeBaseArgs = serde_json::from_value(call_args)
              .map_err(|e| e.to_string())?;
            search_knowledge_base_tool.call(args).await.map_err(|e| e.to_string())?
          }
          "write_skill" => {
            let args: WriteSkillArgs = serde_json::from_value(call_args)
              .map_err(|e| e.to_string())?;
            write_skill_tool.call(args).await.map_err(|e| e.to_string())?
          }
          "get_current_datetime" | "get_datetime" => {
            let args: GetCurrentDatetimeArgs = serde_json::from_value(call_args)
              .map_err(|e| e.to_string())?;
            datetime_tool.call(args).await.map_err(|e| e.to_string())?
          }
          "run_shell" | "execute_shell" | "shell_command" | "exec_command" => {
            let args: RunShellArgs = serde_json::from_value(call_args)
              .map_err(|e| e.to_string())?;
            shell_tool.call(args).await.map_err(|e| e.to_string())?
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
                    res
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
                    return Err(e);
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
                return Err(err_msg);
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
              return Err(err_msg);
            }
          }
        };

        println!("[llm2][tool_result] Tool '{}' succeeded.", call_name);

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
  }

  Ok(accumulated_final_text)
}
