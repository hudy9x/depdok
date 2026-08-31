use serde_json::json;

use crate::llm2::types::OllamaMessage;

/// Builder pattern for assembling Ollama `/api/chat` request payloads.
pub struct OllamaChatRequestBuilder {
  model: String,
  messages: serde_json::Value,
  tools: Option<serde_json::Value>,
  think: bool,
  num_ctx: usize,
  temperature: f32,
}

impl OllamaChatRequestBuilder {
  pub fn new(model: impl Into<String>) -> Self {
    Self {
      model: model.into(),
      messages: json!([]),
      tools: None,
      think: true,
      num_ctx: 16384,
      temperature: 0.2,
    }
  }

  pub fn messages(mut self, history: &[OllamaMessage]) -> Self {
    self.messages = json!(history);
    self
  }

  pub fn tools(mut self, tools_schema: &serde_json::Value) -> Self {
    let has_tools = tools_schema
      .as_array()
      .map(|arr| !arr.is_empty())
      .unwrap_or(false);

    if has_tools {
      self.tools = Some(tools_schema.clone());
    } else {
      self.tools = None;
    }
    self
  }

  pub fn think(mut self, think_flag: Option<bool>) -> Self {
    self.think = think_flag.unwrap_or(true);
    self
  }

  pub fn num_ctx(mut self, num_ctx: usize) -> Self {
    self.num_ctx = num_ctx;
    self
  }

  pub fn temperature(mut self, temperature: f32) -> Self {
    self.temperature = temperature;
    self
  }

  pub fn build(self) -> serde_json::Value {
    let mut request_map = serde_json::Map::new();
    request_map.insert("model".to_string(), json!(self.model));
    request_map.insert("messages".to_string(), self.messages);
    if let Some(t) = self.tools {
      request_map.insert("tools".to_string(), t);
    }
    request_map.insert("stream".to_string(), json!(true));
    request_map.insert("think".to_string(), json!(self.think));
    request_map.insert(
      "options".to_string(),
      json!({
        "num_ctx": self.num_ctx,
        "temperature": self.temperature
      }),
    );
    serde_json::Value::Object(request_map)
  }
}
