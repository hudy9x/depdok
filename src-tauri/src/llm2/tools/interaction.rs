use rig::tool::PortableTool;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::AppHandle;

use super::bridge::{call_frontend_tool, ToolBridgeError};
use crate::llm2::runtime::PendingRequests;

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
      if trimmed.starts_with('[') && trimmed.ends_with(']') {
        if let Ok(parsed) = serde_json::from_str::<Vec<String>>(trimmed) {
          return Ok(Some(parsed));
        }
      }
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

// AskUserTool
#[derive(Clone)]
pub struct AskUserTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct AskUserArgs {
  pub question: String,
  #[serde(default, deserialize_with = "deserialize_flexible_string_vec")]
  pub options: Option<Vec<String>>,
  #[serde(default)]
  pub allow_custom: Option<bool>,
}

impl PortableTool for AskUserTool {
  const NAME: &'static str = "ask_user";
  type Error = ToolBridgeError;
  type Args = AskUserArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Ask the user a clarification question with an optional list of selectable choices/options. Pauses execution and awaits user input or button click in the UI before continuing.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "question": {
          "type": "string",
          "description": "The question or prompt to present to the user (e.g. 'Which topic would you like to search for?')"
        },
        "options": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Optional list of predefined choices/buttons for the user to click (e.g. ['Plan & Tasks', 'Requirements', 'Decisions', 'Meetings', 'Q&A', 'All (*)'])"
        },
        "allow_custom": {
          "type": "boolean",
          "description": "Whether to allow the user to type a custom response in addition to picking an option (default: true)"
        }
      },
      "required": ["question"]
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
  fn test_ask_user_args_deserialization() {
    let raw_json = r#"{"question":"Which category?","options":"[\"Plan\",\"Meetings\"]"}"#;
    let args: AskUserArgs = serde_json::from_str(raw_json).unwrap();
    assert_eq!(args.question, "Which category?");
    assert_eq!(args.options, Some(vec!["Plan".to_string(), "Meetings".to_string()]));

    let raw_json_arr = r#"{"question":"Which category?","options":["Plan","Meetings"]}"#;
    let args_arr: AskUserArgs = serde_json::from_str(raw_json_arr).unwrap();
    assert_eq!(args_arr.options, Some(vec!["Plan".to_string(), "Meetings".to_string()]));
  }
}
