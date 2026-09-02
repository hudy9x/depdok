use rig::tool::PortableTool;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::AppHandle;

use super::bridge::{call_frontend_tool, ToolBridgeError};
use crate::llm2::runtime::PendingRequests;

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
