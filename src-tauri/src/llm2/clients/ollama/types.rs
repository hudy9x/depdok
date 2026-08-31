use crate::llm2::types::OllamaToolCall;

#[derive(Debug, Clone)]
pub struct StreamTurnResult {
  pub turn_text: String,
  pub tool_calls: Vec<OllamaToolCall>,
  pub cancelled: bool,
}

#[derive(Debug, Default, Clone)]
pub struct StreamMetrics {
  pub accumulated_eval_tokens: u64,
  pub latest_prompt_tokens: u64,
}

#[derive(Debug, Clone)]
pub enum ParsedChunk {
  Token(String),
  Thought(String),
  ToolCall(OllamaToolCall),
  Done {
    prompt_eval_count: u64,
    eval_count: u64,
  },
}
