use rig::tool::PortableTool;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Manager};

use super::bridge::{call_frontend_tool, ToolBridgeError};
use crate::llm2::runtime::PendingRequests;

// SearchKnowledgeBaseTool
#[derive(Clone)]
pub struct SearchKnowledgeBaseTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SearchKnowledgeBaseArgs {
  pub query: String,
  #[serde(default)]
  pub limit: Option<usize>,
  #[serde(default)]
  pub project: Option<String>,
}

impl PortableTool for SearchKnowledgeBaseTool {
  const NAME: &'static str = "search_knowledge_base";
  type Error = ToolBridgeError;
  type Args = SearchKnowledgeBaseArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Search the local workspace knowledge base and indexed documentation using semantic and hybrid vector retrieval to find relevant notes, specifications, guides, and section contents within the active project or specified project path.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "query": { "type": "string", "description": "The search query or concept to search for across the indexed workspace notes and documents (e.g. 'authentication flow', 'markdown pagination', 'sqlite vector setup')" },
        "limit": { "type": "integer", "description": "Maximum number of relevant section results to return (default: 6, max: 20)" },
        "project": { "type": "string", "description": "The project or folder path to scope the search within (e.g. the current workspace or project folder path)." }
      },
      "required": ["query", "project"]
    })
  }

  async fn call(&self, mut args: Self::Args) -> Result<Self::Output, Self::Error> {
    let mut resolved_project = args.project.clone();
    if resolved_project.is_none() {
      if let Some(project_state) = self.app.try_state::<crate::knowledge_base::CurrentProject>() {
        if let Ok(guard) = project_state.0.lock() {
          if let Some(ref current_project) = *guard {
            resolved_project = Some(current_project.clone());
          }
        }
      }
    }
    args.project = resolved_project;
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}

// ListKnowledgeBaseProjectsTool
#[derive(Clone)]
pub struct ListKnowledgeBaseProjectsTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ListKnowledgeBaseProjectsArgs {
  #[serde(default)]
  pub query: Option<String>,
}

impl PortableTool for ListKnowledgeBaseProjectsTool {
  const NAME: &'static str = "list_knowledge_base_projects";
  type Error = ToolBridgeError;
  type Args = ListKnowledgeBaseProjectsArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "List all indexed projects, workspace folders, and their document counts in the knowledge base. Use this to discover available projects or find a project path for cross-project searches.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "query": { "type": "string", "description": "Optional search term to filter projects by name or path." }
      }
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}

// ListKnowledgeBaseGroupsTool (Backward Compatibility Alias)
#[derive(Clone)]
pub struct ListKnowledgeBaseGroupsTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ListKnowledgeBaseGroupsArgs {
  #[serde(default)]
  pub query: Option<String>,
}

impl PortableTool for ListKnowledgeBaseGroupsTool {
  const NAME: &'static str = "list_knowledge_base_groups";
  type Error = ToolBridgeError;
  type Args = ListKnowledgeBaseGroupsArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "List all indexed projects, workspace folders, and their document counts in the knowledge base (alias for list_knowledge_base_projects).".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "query": { "type": "string", "description": "Optional search term to filter groups/projects by name or path." }
      }
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}
