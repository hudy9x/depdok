use rig::tool::PortableTool;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::AppHandle;

use super::bridge::{call_frontend_tool, ToolBridgeError};
use crate::llm2::pending::PendingRequests;

#[derive(Clone)]
pub struct WriteSkillTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct WriteSkillArgs {
  #[serde(default)]
  pub name: Option<String>,
  pub content: String,
}

impl PortableTool for WriteSkillTool {
  const NAME: &'static str = "write_skill";
  type Error = ToolBridgeError;
  type Args = WriteSkillArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Write or update a project skill Markdown file in .depdok/skills/<name>.md. Content must include YAML frontmatter (name, description, tools) and markdown body instructions.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
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
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}

// ReloadSkillsTool
#[derive(Clone)]
pub struct ReloadSkillsTool {
  pub app: AppHandle,
}

#[derive(Debug, Deserialize, Serialize, Default)]
pub struct ReloadSkillsArgs {
  #[serde(default, alias = "workspace", alias = "workspace_path", alias = "root")]
  pub workspace_root: Option<String>,
}

impl PortableTool for ReloadSkillsTool {
  const NAME: &'static str = "reload_skills";
  type Error = ToolBridgeError;
  type Args = ReloadSkillsArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Reload and rebuild the workspace AI skills cache from .depdok/skills/*.md. Returns the updated list of available skills and their declared tools.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "workspace_root": {
          "type": "string",
          "description": "Optional workspace root directory path. Defaults to active workspace."
        }
      }
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    let ws_root = args.workspace_root.as_deref().unwrap_or(".");
    match crate::llm2::skills::reload_skills(ws_root, &self.app) {
      Ok(skills) => {
        let skills_list: Vec<serde_json::Value> = skills
          .iter()
          .map(|s| {
            json!({
              "name": s.name,
              "description": s.description,
              "tools": s.tools,
              "file_path": s.file_path
            })
          })
          .collect();

        Ok(json!({
          "success": true,
          "total_skills": skills.len(),
          "skills": skills_list,
          "message": format!("Successfully reloaded {} skill(s) from .depdok/skills/", skills.len())
        }))
      }
      Err(e) => Err(ToolBridgeError(e)),
    }
  }
}

