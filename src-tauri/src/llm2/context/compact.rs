use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;

use super::sliding_window::estimate_message_tokens;
use crate::llm2::types::OllamaMessage;

/// Maximum characters allowed in historical tool output before folding into compact preview.
pub const MAX_COMPACT_TOOL_PAYLOAD_CHARS: usize = 350;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompactedResult {
  pub summary: String,
  pub original_turns: usize,
  pub estimated_tokens_before: usize,
  pub estimated_tokens_after: usize,
}

/// Compacts older tool payloads in conversation history to concise representations,
/// dramatically reducing token waste for completed operations.
pub fn compact_tool_payloads(messages: &mut [OllamaMessage]) -> (usize, usize) {
  let mut count = 0usize;
  let mut chars_saved = 0usize;
  for msg in messages.iter_mut() {
    if msg.role == "tool" && msg.content.len() > MAX_COMPACT_TOOL_PAYLOAD_CHARS {
      let orig_len = msg.content.len();
      let preview = &msg.content[..MAX_COMPACT_TOOL_PAYLOAD_CHARS];
      msg.content = format!(
        "{}\n... [Historical tool output compacted: {} total characters]",
        preview,
        orig_len
      );
      chars_saved += orig_len.saturating_sub(msg.content.len());
      count += 1;
    }
  }
  (count, chars_saved)
}

/// Summarizes a slice of conversation turns into an executive 2-4 bullet point summary using Ollama.
pub async fn summarize_conversation_turns(
  client: &Client,
  model_name: &str,
  turns: &[OllamaMessage],
) -> Result<String, String> {
  if turns.is_empty() {
    return Ok(String::new());
  }

  // Format the turns for the summarizer prompt
  let mut transcript = String::new();
  for msg in turns {
    if msg.role == "system" {
      continue;
    }
    let role_label = match msg.role.as_str() {
      "user" => "User",
      "assistant" => "Assistant",
      "tool" => "Tool Result",
      _ => "Other",
    };
    let cleaned_content = if msg.role == "assistant" {
      super::strip_thinking_tags(&msg.content)
    } else {
      msg.content.clone()
    };

    if cleaned_content.trim().is_empty() {
      continue;
    }

    let content_snippet = if cleaned_content.len() > 600 {
      format!("{}... [truncated]", &cleaned_content[..600])
    } else {
      cleaned_content
    };
    transcript.push_str(&format!("{}: {}\n", role_label, content_snippet));
  }

  let prompt = format!(
    "Summarize the key goals, files created/modified, data computed, and decisions made in the following conversation transcript in 2 to 4 concise bullet points. Be factual, dense, and direct. Do not include intro or outro text.\n\nTranscript:\n{}\n\nSummary:",
    transcript
  );

  let req_body = json!({
    "model": model_name,
    "prompt": prompt,
    "stream": false,
    "options": {
      "temperature": 0.2,
      "num_ctx": 4096
    }
  });

  println!("[llm2][compact] 📝 Requesting conversation summarization with model '{}'...", model_name);

  let res = client
    .post("http://localhost:11434/api/generate")
    .json(&req_body)
    .send()
    .await
    .map_err(|e| format!("Failed to call Ollama generate API: {}", e))?;

  if !res.status().is_success() {
    let err = res.text().await.unwrap_or_default();
    return Err(format!("Ollama summarizer returned error: {}", err));
  }

  let res_json: serde_json::Value = res
    .json()
    .await
    .map_err(|e| format!("Failed to parse summarization response: {}", e))?;

  let summary = res_json
    .get("response")
    .and_then(|r| r.as_str())
    .unwrap_or("No summary generated.")
    .trim()
    .to_string();

  Ok(summary)
}

/// Compacts a full message history vector into a summary result.
pub async fn compact_full_history(
  client: &Client,
  model_name: &str,
  messages: Vec<OllamaMessage>,
) -> Result<CompactedResult, String> {
  let original_turns = messages
    .iter()
    .filter(|m| m.role == "user" || m.role == "assistant")
    .count();

  let tokens_before: usize = messages.iter().map(estimate_message_tokens).sum();

  let summary = summarize_conversation_turns(client, model_name, &messages).await?;

  let summary_msg = OllamaMessage {
    role: "system".to_string(),
    content: format!("[Previous Conversation Context Summary]:\n{}", summary),
    tool_calls: None,
  };

  let tokens_after = estimate_message_tokens(&summary_msg);

  Ok(CompactedResult {
    summary,
    original_turns,
    estimated_tokens_before: tokens_before,
    estimated_tokens_after: tokens_after,
  })
}
