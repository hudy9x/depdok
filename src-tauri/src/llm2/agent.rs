use futures_util::StreamExt;
use rig::tool::PortableTool;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Emitter};

use super::pending::PendingRequests;
use super::tools::{
  AddMarkdownCommentArgs, AddMarkdownCommentTool, CreateFileArgs, CreateFileTool,
  CreateFolderArgs, CreateFolderTool, DeleteFileOrFolderArgs, DeleteFileOrFolderTool,
  GenerateContentArgs, GenerateContentTool, GetUserAgeArgs, GetUserAgeTool,
  GetUserCountryArgs, GetUserCountryTool, GetUserDobArgs, GetUserDobTool,
  GetUserNameArgs, GetUserNameTool, ReadMarkdownArgs, ReadMarkdownTool,
  RenameFileArgs, RenameFileTool, RenameFolderArgs, RenameFolderTool,
  SumFourDigitsArgs, SumFourDigitsTool, UpsertMarkdownArgs,
  UpsertMarkdownSectionArgs, UpsertMarkdownSectionTool, UpsertMarkdownTool,
};

pub const TOOL_MODEL: &str = "qwen2.5:7b";
pub const CONTENT_MODEL: &str = "gemma2:9b";

const SYSTEM_PROMPT: &str = "\
You are a helpful, precise, and capable AI desktop assistant for the Depdok document editor.
You operate in a Dual-Model Specialization architecture:
- You (qwen2.5:7b) are the Tool & Orchestration Specialist: fast intent recognition, accurate tool calls, and structured workflow management.
- You have access to 'generate_content', which delegates long-form Markdown prose, creative writing, in-depth reports, tutorials, and editorial review to the Content Specialist (gemma2:9b).

Available tools:
- 'read_markdown': Read the content of a markdown file or active open document (returns content, headings outline, word count, and comments).
- 'upsert_markdown': Create, overwrite, or update the full content of a markdown file.
- 'upsert_markdown_section': Surgically update an existing section or append a new section by heading name (e.g. 'Conclusion') or target text snippet without affecting the rest of the document.
- 'add_markdown_comment': Add an inline review comment on a specific text excerpt in a markdown file.
- 'generate_content': Delegate rich, creative, or long-form Markdown generation to the Content Specialist model (gemma2:9b).
- 'create_file': Create a new file with optional content (e.g. 'notes.md', 'plan.txt').
- 'create_folder': Create a new folder (e.g. 'docs', 'src/components').
- 'rename_file': Rename an existing file (e.g. old_path: 'old.md', new_name: 'new.md').
- 'rename_folder': Rename an existing folder (e.g. old_path: 'old_folder', new_name: 'new_folder').
- 'delete_file_or_folder': Delete a file or folder from the workspace.
- 'get_user_name': Look up user name by ID.
- 'get_user_age': Get user's age by name.
- 'get_user_country': Get user's country by name.
- 'get_user_dob': Get user's date of birth by name.
- 'sum_four_digits': Sum 4 numbers.

IMPORTANT RULES:
- When asked to draft, write, or expand rich markdown articles, tutorials, or deep reviews, invoke 'generate_content' to leverage gemma2:9b.
- When asked to review, inspect, or summarize an active markdown file, call 'read_markdown' first.
- When asked to add or update a section (e.g. 'Add Conclusion in test.md'), call 'upsert_markdown_section'.
- When a user mentions a file using '@' (e.g. '@notes.md' or '@docs/guide.md'), use that path in your tool calls.
- Once all tool results are provided, synthesize a clear, helpful final response.";

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
) -> Result<String, String> {
  let model_to_use = model_name
    .filter(|s| !s.trim().is_empty())
    .unwrap_or_else(|| TOOL_MODEL.to_string());
  println!("[llm2][agent] Starting prompt with tool model '{}' (content model '{}'): {:?}", model_to_use, CONTENT_MODEL, prompt);

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

  let read_markdown_tool = ReadMarkdownTool { app: app.clone(), pending: pending.clone() };
  let upsert_markdown_tool = UpsertMarkdownTool { app: app.clone(), pending: pending.clone() };
  let upsert_markdown_section_tool = UpsertMarkdownSectionTool { app: app.clone(), pending: pending.clone() };
  let add_markdown_comment_tool = AddMarkdownCommentTool { app: app.clone(), pending: pending.clone() };
  let generate_content_tool = GenerateContentTool { app: app.clone() };

  let tools_schema = json!([
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
    }
  ]);

  let mut history: Vec<OllamaMessage> = vec![
    OllamaMessage {
      role: "system".to_string(),
      content: SYSTEM_PROMPT.to_string(),
      tool_calls: None,
    },
    OllamaMessage {
      role: "user".to_string(),
      content: prompt.to_string(),
      tool_calls: None,
    },
  ];

  let mut accumulated_final_text = String::new();

  // Multi-turn streaming resolution loop
  for turn in 0..6 {
    let request_body = json!({
      "model": model_to_use,
      "messages": history,
      "tools": tools_schema,
      "stream": true,
    });

    println!("\n════════════════════ [llm2][turn {}] REQUEST TO OLLAMA ════════════════════", turn);
    println!("Model: {}", model_to_use);
    if let Ok(pretty_req) = serde_json::to_string_pretty(&request_body) {
      println!("Payload:\n{}", pretty_req);
    } else {
      println!("Payload: {:?}", request_body);
    }
    println!("────────────────────────────────────────────────────────────────────────────");

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

    let mut stream = response.bytes_stream();
    let mut turn_text = String::new();
    let mut collected_tool_calls: Vec<OllamaToolCall> = Vec::new();
    let mut buffer = String::new();

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
          if let Some(msg) = val.get("message") {
            // Regular content delta
            if let Some(content) = msg.get("content").and_then(|c| c.as_str()) {
              if !content.is_empty() {
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
        if let Some(msg) = val.get("message") {
          if let Some(content) = msg.get("content").and_then(|c| c.as_str()) {
            if !content.is_empty() {
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
                collected_tool_calls.push(tool_call);
              }
            }
          }
        }
      }
    }

    println!("\n════════════════════ [llm2][turn {}] RESPONSE FROM OLLAMA ════════════════════", turn);
    println!("Text delta (len {}):\n{}", turn_text.len(), if turn_text.is_empty() { "<empty>" } else { &turn_text });
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
          unknown => return Err(format!("Unknown tool: {}", unknown)),
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
