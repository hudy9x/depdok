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

// 11. MoveFilesOrFoldersTool
#[derive(Clone)]
pub struct MoveFilesOrFoldersTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct MoveFilesOrFoldersArgs {
  pub paths: Vec<String>,
  pub destination_folder: String,
}

impl PortableTool for MoveFilesOrFoldersTool {
  const NAME: &'static str = "move_files_or_folders";
  type Error = ToolBridgeError;
  type Args = MoveFilesOrFoldersArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Move or cut one or more files and/or folders to a destination folder in the workspace.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "paths": {
          "type": "array",
          "items": { "type": "string" },
          "description": "List of file or directory paths to move"
        },
        "destination_folder": {
          "type": "string",
          "description": "Target destination folder path (e.g. 'archive' or 'src/components')"
        }
      },
      "required": ["paths", "destination_folder"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}

// 12. ListFilesTool
#[derive(Clone)]
pub struct ListFilesTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ListFilesArgs {
  #[serde(default)]
  pub path: Option<String>,
  #[serde(default)]
  pub recursive: Option<bool>,
  #[serde(default)]
  pub max_depth: Option<u32>,
  #[serde(default)]
  pub include_hidden: Option<bool>,
}

impl PortableTool for ListFilesTool {
  const NAME: &'static str = "list_files";
  type Error = ToolBridgeError;
  type Args = ListFilesArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "List or recursively traverse files and directories in the workspace or a specific folder. Returns file tree and relative paths.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
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
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}

// SearchFileTool
#[derive(Clone)]
pub struct SearchFileTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SearchFileArgs {
  pub query: String,
  #[serde(default)]
  pub limit: Option<usize>,
}

impl PortableTool for SearchFileTool {
  const NAME: &'static str = "search_file";
  type Error = ToolBridgeError;
  type Args = SearchFileArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Quickly search for files or folders across the workspace by filename, path, or keyword using high-performance fuzzy matching.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
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
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}


