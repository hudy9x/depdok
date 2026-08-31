use crate::llm2::types::OllamaToolCall;
use super::types::ParsedChunk;

/// Stream parser and decoder for Ollama NDJSON chunks.
pub struct OllamaChunkParser {
  buffer: String,
}

impl OllamaChunkParser {
  pub fn new() -> Self {
    Self {
      buffer: String::new(),
    }
  }

  /// Feeds incoming binary stream bytes into the buffer and parses complete lines.
  pub fn feed(&mut self, chunk_bytes: &[u8]) -> Vec<ParsedChunk> {
    let chunk_str = String::from_utf8_lossy(chunk_bytes);
    self.buffer.push_str(&chunk_str);

    let mut events = Vec::new();
    while let Some(pos) = self.buffer.find('\n') {
      let line = self.buffer[..pos].trim().to_string();
      self.buffer = self.buffer[pos + 1..].to_string();

      if line.is_empty() {
        continue;
      }

      if let Some(parsed) = Self::parse_line(&line) {
        events.extend(parsed);
      }
    }
    events
  }

  /// Flushes any remaining bytes in the buffer.
  pub fn flush(&mut self) -> Vec<ParsedChunk> {
    let remaining = self.buffer.trim().to_string();
    self.buffer.clear();

    if remaining.is_empty() {
      Vec::new()
    } else {
      Self::parse_line(&remaining).unwrap_or_default()
    }
  }

  fn parse_line(line: &str) -> Option<Vec<ParsedChunk>> {
    let val: serde_json::Value = serde_json::from_str(line).ok()?;
    let mut chunks = Vec::new();

    // Check completion & metrics
    if val.get("done").and_then(|d| d.as_bool()).unwrap_or(false) {
      let prompt_eval = val.get("prompt_eval_count").and_then(|v| v.as_u64()).unwrap_or(0);
      let eval = val.get("eval_count").and_then(|v| v.as_u64()).unwrap_or(0);
      chunks.push(ParsedChunk::Done {
        prompt_eval_count: prompt_eval,
        eval_count: eval,
      });
    }

    if let Some(msg) = val.get("message") {
      // Content text delta
      if let Some(content) = msg.get("content").and_then(|c| c.as_str()) {
        if !content.is_empty() {
          chunks.push(ParsedChunk::Token(content.to_string()));
        }
      }

      // Thinking scratchpad delta
      if let Some(thinking) = msg.get("thinking").and_then(|t| t.as_str()) {
        if !thinking.is_empty() {
          chunks.push(ParsedChunk::Thought(thinking.to_string()));
        }
      }

      // Tool calls array
      if let Some(tc_array) = msg.get("tool_calls").and_then(|t| t.as_array()) {
        for tc in tc_array {
          if let Ok(tool_call) = serde_json::from_value::<OllamaToolCall>(tc.clone()) {
            chunks.push(ParsedChunk::ToolCall(tool_call));
          }
        }
      }
    }

    Some(chunks)
  }
}
