use rig::tool::PortableTool;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::AppHandle;

use super::bridge::{call_frontend_tool, ToolBridgeError};
use crate::llm2::pending::PendingRequests;

// 6. CreateFileTool
#[derive(Clone)]
pub struct CreateFileTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateFileArgs {
  pub path: String,
  #[serde(default)]
  pub content: Option<String>,
}

impl PortableTool for CreateFileTool {
  const NAME: &'static str = "create_file";
  type Error = ToolBridgeError;
  type Args = CreateFileArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Create a new file in the workspace or specific path. Can optionally supply initial file content.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "path": { "type": "string", "description": "The path or name of the file to create (e.g. 'notes.md' or 'src/utils.ts')" },
        "content": { "type": "string", "description": "Optional initial text content for the file" }
      },
      "required": ["path"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}

// 7. CreateFolderTool
#[derive(Clone)]
pub struct CreateFolderTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateFolderArgs {
  pub path: String,
}

impl PortableTool for CreateFolderTool {
  const NAME: &'static str = "create_folder";
  type Error = ToolBridgeError;
  type Args = CreateFolderArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Create a new folder/directory in the workspace at the specified path.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "path": { "type": "string", "description": "The path or name of the folder to create (e.g. 'docs' or 'src/components')" }
      },
      "required": ["path"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}

// 8. RenameFileTool
#[derive(Clone)]
pub struct RenameFileTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct RenameFileArgs {
  pub old_path: String,
  pub new_name: String,
}

impl PortableTool for RenameFileTool {
  const NAME: &'static str = "rename_file";
  type Error = ToolBridgeError;
  type Args = RenameFileArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Rename a file in the workspace from old_path to new_name.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "old_path": { "type": "string", "description": "The existing path or name of the file to rename" },
        "new_name": { "type": "string", "description": "The new name or new destination path for the file" }
      },
      "required": ["old_path", "new_name"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}

// 9. RenameFolderTool
#[derive(Clone)]
pub struct RenameFolderTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct RenameFolderArgs {
  pub old_path: String,
  pub new_name: String,
}

impl PortableTool for RenameFolderTool {
  const NAME: &'static str = "rename_folder";
  type Error = ToolBridgeError;
  type Args = RenameFolderArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Rename a folder/directory in the workspace from old_path to new_name.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "old_path": { "type": "string", "description": "The existing path or name of the folder to rename" },
        "new_name": { "type": "string", "description": "The new name or new destination path for the folder" }
      },
      "required": ["old_path", "new_name"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}

// 10. DeleteFileOrFolderTool
#[derive(Clone)]
pub struct DeleteFileOrFolderTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct DeleteFileOrFolderArgs {
  pub path: String,
}

impl PortableTool for DeleteFileOrFolderTool {
  const NAME: &'static str = "delete_file_or_folder";
  type Error = ToolBridgeError;
  type Args = DeleteFileOrFolderArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Delete a file or folder from the workspace by path.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "path": { "type": "string", "description": "The path or name of the file or folder to delete" }
      },
      "required": ["path"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}
