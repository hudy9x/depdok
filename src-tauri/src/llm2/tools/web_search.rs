use rig::tool::PortableTool;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::AppHandle;

use super::bridge::{call_frontend_tool, ToolBridgeError};
use crate::llm2::pending::PendingRequests;

// WebSearchTool
#[derive(Clone)]
pub struct WebSearchTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct WebSearchArgs {
  pub query: String,
  #[serde(default)]
  pub limit: Option<usize>,
}

impl PortableTool for WebSearchTool {
  const NAME: &'static str = "web_search";
  type Error = ToolBridgeError;
  type Args = WebSearchArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Search the web for up-to-date information, facts, technical guides, documentation, APIs, and news. Returns top search results with titles, snippets, and URLs.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "The search query or keywords to search for online (e.g. 'claude code setup guide', 'tauri v2 release notes', 'react 19 server actions')"
        },
        "limit": {
          "type": "integer",
          "description": "Maximum number of search results to return (default: 5, max: 10)"
        }
      },
      "required": ["query"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}

// FetchWebPageTool
#[derive(Clone)]
pub struct FetchWebPageTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct FetchWebPageArgs {
  pub url: String,
}

impl PortableTool for FetchWebPageTool {
  const NAME: &'static str = "fetch_web_page";
  type Error = ToolBridgeError;
  type Args = FetchWebPageArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Fetch and read the full readable text/markdown content of a webpage by URL. Strips navigation, ads, and scripts to return clean article/doc text.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "url": {
          "type": "string",
          "description": "The full HTTP/HTTPS URL of the webpage to fetch and read (e.g. 'https://docs.anthropic.com/en/docs/...')"
        }
      },
      "required": ["url"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}
