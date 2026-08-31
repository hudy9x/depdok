use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaToolCall {
  pub function: OllamaFunctionCall,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaFunctionCall {
  pub name: String,
  pub arguments: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaMessage {
  pub role: String,
  pub content: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub tool_calls: Option<Vec<OllamaToolCall>>,
}
