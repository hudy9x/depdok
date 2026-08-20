use rig::tool::PortableTool;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fmt::Display;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use super::pending::PendingRequests;

#[derive(Debug)]
pub struct ToolBridgeError(pub String);

impl Display for ToolBridgeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for ToolBridgeError {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolRequestPayload {
    pub request_id: String,
    pub tool_name: String,
    pub args: serde_json::Value,
}

pub async fn call_frontend_tool<Args: Serialize>(
    app: &AppHandle,
    pending: &PendingRequests,
    tool_name: &str,
    args: Args,
) -> Result<serde_json::Value, ToolBridgeError> {
    let request_id = Uuid::new_v4().to_string();
    let (tx, rx) = tokio::sync::oneshot::channel();

    pending.insert(request_id.clone(), tx);

    let args_val = serde_json::to_value(args)
        .map_err(|e| ToolBridgeError(format!("Failed to serialize tool args: {}", e)))?;

    let payload = ToolRequestPayload {
        request_id: request_id.clone(),
        tool_name: tool_name.to_string(),
        args: args_val,
    };

    // Emit event to React frontend
    if let Err(e) = app.emit("tool_request", &payload) {
        pending.remove(&request_id);
        return Err(ToolBridgeError(format!("Failed to emit event to frontend: {}", e)));
    }

    // Await response from React with a 15-second timeout safeguard
    match tokio::time::timeout(Duration::from_secs(15), rx).await {
        Ok(Ok(Ok(val))) => Ok(val),
        Ok(Ok(Err(err_msg))) => Err(ToolBridgeError(format!("Frontend error: {}", err_msg))),
        Ok(Err(_)) => Err(ToolBridgeError("Channel closed unexpectedly".to_string())),
        Err(_) => {
            pending.remove(&request_id);
            Err(ToolBridgeError("Tool execution timed out after 15 seconds".to_string()))
        }
    }
}

// 1. GetUserNameTool
#[derive(Clone)]
pub struct GetUserNameTool {
    pub app: AppHandle,
    pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct GetUserNameArgs {
    pub id: i64,
}

impl PortableTool for GetUserNameTool {
    const NAME: &'static str = "get_user_name";
    type Error = ToolBridgeError;
    type Args = GetUserNameArgs;
    type Output = serde_json::Value;

    fn description(&self) -> String {
        "Get the full name of a user by their user ID from the user database.".to_string()
    }

    fn parameters(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "id": { "type": "integer", "description": "The numeric ID of the user" }
            },
            "required": ["id"]
        })
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
    }
}

// 2. GetUserAgeTool
#[derive(Clone)]
pub struct GetUserAgeTool {
    pub app: AppHandle,
    pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct GetUserAgeArgs {
    pub name: String,
}

impl PortableTool for GetUserAgeTool {
    const NAME: &'static str = "get_user_age";
    type Error = ToolBridgeError;
    type Args = GetUserAgeArgs;
    type Output = serde_json::Value;

    fn description(&self) -> String {
        "Get the age of a specific user by their name from the user database.".to_string()
    }

    fn parameters(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "name": { "type": "string", "description": "The full name of the user" }
            },
            "required": ["name"]
        })
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
    }
}

// 3. GetUserCountryTool
#[derive(Clone)]
pub struct GetUserCountryTool {
    pub app: AppHandle,
    pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct GetUserCountryArgs {
    pub name: String,
}

impl PortableTool for GetUserCountryTool {
    const NAME: &'static str = "get_user_country";
    type Error = ToolBridgeError;
    type Args = GetUserCountryArgs;
    type Output = serde_json::Value;

    fn description(&self) -> String {
        "Get the country of residence / nationality of a specific user by their name.".to_string()
    }

    fn parameters(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "name": { "type": "string", "description": "The full name of the user" }
            },
            "required": ["name"]
        })
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
    }
}

// 4. GetUserDobTool
#[derive(Clone)]
pub struct GetUserDobTool {
    pub app: AppHandle,
    pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct GetUserDobArgs {
    pub name: String,
}

impl PortableTool for GetUserDobTool {
    const NAME: &'static str = "get_user_dob";
    type Error = ToolBridgeError;
    type Args = GetUserDobArgs;
    type Output = serde_json::Value;

    fn description(&self) -> String {
        "Get the date of birth (DOB) of a specific user by their name in YYYY-MM-DD format.".to_string()
    }

    fn parameters(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "name": { "type": "string", "description": "The full name of the user" }
            },
            "required": ["name"]
        })
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
    }
}

// 5. SumFourDigitsTool
#[derive(Clone)]
pub struct SumFourDigitsTool {
    pub app: AppHandle,
    pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SumFourDigitsArgs {
    pub a: f64,
    pub b: f64,
    pub c: f64,
    pub d: f64,
}

impl PortableTool for SumFourDigitsTool {
    const NAME: &'static str = "sum_four_digits";
    type Error = ToolBridgeError;
    type Args = SumFourDigitsArgs;
    type Output = serde_json::Value;

    fn description(&self) -> String {
        "Calculate the sum of four numbers (a, b, c, d).".to_string()
    }

    fn parameters(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "a": { "type": "number", "description": "First number" },
                "b": { "type": "number", "description": "Second number" },
                "c": { "type": "number", "description": "Third number" },
                "d": { "type": "number", "description": "Fourth number" }
            },
            "required": ["a", "b", "c", "d"]
        })
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
    }
}

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
