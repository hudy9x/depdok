use rig::tool::PortableTool;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::AppHandle;

use super::bridge::{call_frontend_tool, ToolBridgeError};
use crate::llm2::pending::PendingRequests;

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
}

impl PortableTool for SearchKnowledgeBaseTool {
  const NAME: &'static str = "search_knowledge_base";
  type Error = ToolBridgeError;
  type Args = SearchKnowledgeBaseArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Search the local workspace knowledge base and indexed documentation using semantic and hybrid vector retrieval to find relevant notes, specifications, guides, and section contents.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "query": { "type": "string", "description": "The search query or concept to search for across the indexed workspace notes and documents (e.g. 'authentication flow', 'markdown pagination', 'sqlite vector setup')" },
        "limit": { "type": "integer", "description": "Maximum number of relevant section results to return (default: 6, max: 20)" }
      },
      "required": ["query"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}
