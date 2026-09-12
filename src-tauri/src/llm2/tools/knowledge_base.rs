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

fn deserialize_flexible_string_vec<'de, D>(deserializer: D) -> Result<Option<Vec<String>>, D::Error>
where
  D: serde::Deserializer<'de>,
{
  struct FlexibleStringVecVisitor;

  impl<'de> serde::de::Visitor<'de> for FlexibleStringVecVisitor {
    type Value = Option<Vec<String>>;

    fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
      formatter.write_str("a string, list of strings, or stringified JSON array")
    }

    fn visit_none<E>(self) -> Result<Self::Value, E>
    where
      E: serde::de::Error,
    {
      Ok(None)
    }

    fn visit_some<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
    where
      D: serde::Deserializer<'de>,
    {
      deserializer.deserialize_any(FlexibleStringVecVisitor)
    }

    fn visit_unit<E>(self) -> Result<Self::Value, E>
    where
      E: serde::de::Error,
    {
      Ok(None)
    }

    fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
    where
      E: serde::de::Error,
    {
      let trimmed = v.trim();
      if trimmed.is_empty() {
        return Ok(None);
      }
      // If it looks like a JSON array, e.g. ["plan"] or ["plan", "requirements"]
      if trimmed.starts_with('[') && trimmed.ends_with(']') {
        if let Ok(parsed) = serde_json::from_str::<Vec<String>>(trimmed) {
          return Ok(Some(parsed));
        }
      }
      // Comma-separated or single string
      let items: Vec<String> = trimmed
        .trim_matches(|c| c == '[' || c == ']')
        .split(',')
        .map(|s| s.trim().trim_matches(|c| c == '"' || c == '\'').to_string())
        .filter(|s| !s.is_empty())
        .collect();

      if items.is_empty() {
        Ok(None)
      } else {
        Ok(Some(items))
      }
    }

    fn visit_string<E>(self, v: String) -> Result<Self::Value, E>
    where
      E: serde::de::Error,
    {
      self.visit_str(&v)
    }

    fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
    where
      A: serde::de::SeqAccess<'de>,
    {
      let mut items = Vec::new();
      while let Some(elem) = seq.next_element::<serde_json::Value>()? {
        match elem {
          serde_json::Value::String(s) => {
            let s_trim = s.trim();
            if !s_trim.is_empty() {
              items.push(s_trim.to_string());
            }
          }
          serde_json::Value::Array(sub_arr) => {
            for sub_val in sub_arr {
              if let serde_json::Value::String(s) = sub_val {
                let s_trim = s.trim();
                if !s_trim.is_empty() {
                  items.push(s_trim.to_string());
                }
              }
            }
          }
          other => {
            let s = other.to_string();
            let s_trim = s.trim().trim_matches('"');
            if !s_trim.is_empty() {
              items.push(s_trim.to_string());
            }
          }
        }
      }
      if items.is_empty() {
        Ok(None)
      } else {
        Ok(Some(items))
      }
    }
  }

  deserializer.deserialize_option(FlexibleStringVecVisitor)
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SearchKnowledgeBaseArgs {
  pub query: String,
  #[serde(default)]
  pub limit: Option<usize>,
  #[serde(default)]
  pub project: Option<String>,
  #[serde(default, deserialize_with = "deserialize_flexible_string_vec")]
  pub categories: Option<Vec<String>>,
  #[serde(default)]
  pub category: Option<String>,
}

impl PortableTool for SearchKnowledgeBaseTool {
  const NAME: &'static str = "search_knowledge_base";
  type Error = ToolBridgeError;
  type Args = SearchKnowledgeBaseArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Search the local workspace knowledge base and indexed documentation using semantic and hybrid vector retrieval to find relevant notes, specifications, decisions, meeting notes, plans, requirements, and Q&A. Supports optional category filtering ('decisions', 'mettings', 'plan', 'requirements', 'qna', or '*' for all categories).".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "query": { "type": "string", "description": "The search query or concept to search for across indexed notes (e.g. 'authentication flow', 'sprint 1 tasks', 'oauth decision')" },
        "limit": { "type": "integer", "description": "Maximum number of relevant section results to return (default: 6, max: 20)" },
        "project": { "type": "string", "description": "The project or folder path to scope the search within." },
        "categories": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Optional list of categories to filter: 'decisions', 'mettings', 'plan', 'requirements', 'qna'. Pass ['*'] to search across all categories."
        },
        "category": {
          "type": "string",
          "description": "Optional single category filter (e.g. 'plan', 'requirements', 'decisions', 'mettings', 'qna', or '*' for all categories)."
        }
      },
      "required": ["query"]
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

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_search_args_deserialization_stringified_json_array() {
    let raw_json = r#"{"query":"kickoff date","categories":"[\"plan\"]"}"#;
    let args: SearchKnowledgeBaseArgs = serde_json::from_str(raw_json).unwrap();
    assert_eq!(args.query, "kickoff date");
    assert_eq!(args.categories, Some(vec!["plan".to_string()]));
  }

  #[test]
  fn test_search_args_deserialization_array_literal() {
    let raw_json = r#"{"query":"kickoff date","categories":["plan","meetings"]}"#;
    let args: SearchKnowledgeBaseArgs = serde_json::from_str(raw_json).unwrap();
    assert_eq!(args.query, "kickoff date");
    assert_eq!(args.categories, Some(vec!["plan".to_string(), "meetings".to_string()]));
  }

  #[test]
  fn test_search_args_deserialization_single_string() {
    let raw_json = r#"{"query":"kickoff date","categories":"plan"}"#;
    let args: SearchKnowledgeBaseArgs = serde_json::from_str(raw_json).unwrap();
    assert_eq!(args.query, "kickoff date");
    assert_eq!(args.categories, Some(vec!["plan".to_string()]));
  }

  #[test]
  fn test_search_args_deserialization_comma_separated() {
    let raw_json = r#"{"query":"kickoff date","categories":"plan, decisions, qna"}"#;
    let args: SearchKnowledgeBaseArgs = serde_json::from_str(raw_json).unwrap();
    assert_eq!(args.query, "kickoff date");
    assert_eq!(
      args.categories,
      Some(vec!["plan".to_string(), "decisions".to_string(), "qna".to_string()])
    );
  }

  #[test]
  fn test_search_args_deserialization_none_and_null() {
    let raw_json = r#"{"query":"kickoff date","categories":null}"#;
    let args: SearchKnowledgeBaseArgs = serde_json::from_str(raw_json).unwrap();
    assert_eq!(args.query, "kickoff date");
    assert_eq!(args.categories, None);

    let raw_json_empty = r#"{"query":"kickoff date"}"#;
    let args_empty: SearchKnowledgeBaseArgs = serde_json::from_str(raw_json_empty).unwrap();
    assert_eq!(args_empty.query, "kickoff date");
    assert_eq!(args_empty.categories, None);
  }
}

