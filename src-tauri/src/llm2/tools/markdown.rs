use rig::tool::PortableTool;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::AppHandle;

use super::bridge::{call_frontend_tool, ToolBridgeError};
use crate::llm2::runtime::PendingRequests;

// 11. ReadMarkdownTool
#[derive(Clone)]
pub struct ReadMarkdownTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ReadMarkdownArgs {
  #[serde(default)]
  pub path: Option<String>,
}

impl PortableTool for ReadMarkdownTool {
  const NAME: &'static str = "read_markdown";
  type Error = ToolBridgeError;
  type Args = ReadMarkdownArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Read the content of a Markdown file (or active open document if path omitted). Returns document text, heading outline (# H1, ## H2), word count, and existing comments.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "path": { "type": "string", "description": "The file path or name (e.g. 'notes.md' or 'docs/guide.md'). Omit or pass 'active' to read the currently active editor document." }
      }
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}

// 12. UpsertMarkdownTool
#[derive(Clone)]
pub struct UpsertMarkdownTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct UpsertMarkdownArgs {
  #[serde(default)]
  pub path: Option<String>,
  pub content: String,
}

impl PortableTool for UpsertMarkdownTool {
  const NAME: &'static str = "upsert_markdown";
  type Error = ToolBridgeError;
  type Args = UpsertMarkdownArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Create, overwrite, or update the full content of a Markdown file (or active open document if path omitted).".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "path": { "type": "string", "description": "The file path or name. Omit or pass 'active' to update the active document." },
        "content": { "type": "string", "description": "The full markdown content to write to the file." }
      },
      "required": ["content"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}

// 13. UpsertMarkdownSectionTool
#[derive(Clone)]
pub struct UpsertMarkdownSectionTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct UpsertMarkdownSectionArgs {
  #[serde(default)]
  pub path: Option<String>,
  #[serde(default)]
  pub heading: Option<String>,
  #[serde(default)]
  pub target_text: Option<String>,
  pub replacement_content: String,
}

impl PortableTool for UpsertMarkdownSectionTool {
  const NAME: &'static str = "upsert_markdown_section";
  type Error = ToolBridgeError;
  type Args = UpsertMarkdownSectionArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Update an existing section or add/append a new section to a Markdown file by section heading (e.g. 'Conclusion') or by replacing a target text snippet. If the heading does not exist, it will be automatically appended to the document.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "path": { "type": "string", "description": "The file path or name. Omit or pass 'active' to target the active document." },
        "heading": { "type": "string", "description": "The heading title of the section to replace (e.g. 'Conclusion' or '## Introduction')." },
        "target_text": { "type": "string", "description": "Exact text snippet to locate and replace in the document." },
        "replacement_content": { "type": "string", "description": "The new replacement markdown content for the specified section or text snippet." }
      },
      "required": ["replacement_content"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}

// 14. AddMarkdownCommentTool
#[derive(Clone)]
pub struct AddMarkdownCommentTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct AddMarkdownCommentArgs {
  #[serde(default)]
  pub path: Option<String>,
  pub target_text: String,
  pub comment: String,
  #[serde(default)]
  pub author: Option<String>,
}

impl PortableTool for AddMarkdownCommentTool {
  const NAME: &'static str = "add_markdown_comment";
  type Error = ToolBridgeError;
  type Args = AddMarkdownCommentArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Add an inline review comment to a specific text excerpt in a Markdown file. Wraps target text with comment mark and adds thread to comment sidebar drawer.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "path": { "type": "string", "description": "The file path or name. Omit or pass 'active' to target the active document." },
        "target_text": { "type": "string", "description": "The exact text quote/snippet in the document to attach the review comment to." },
        "comment": { "type": "string", "description": "The review critique, suggestion, or comment feedback." },
        "author": { "type": "string", "description": "Optional author name for the comment (defaults to 'AI Assistant')." }
      },
      "required": ["target_text", "comment"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}
