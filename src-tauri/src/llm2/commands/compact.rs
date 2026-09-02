use crate::llm2::context::compact::{compact_full_history, CompactedResult};
use crate::llm2::types::OllamaMessage;

#[tauri::command]
pub async fn llm2_compact_history(
  messages: Vec<OllamaMessage>,
  model: Option<String>,
) -> Result<CompactedResult, String> {
  let client = reqwest::Client::new();
  let model_to_use = model
    .filter(|s| !s.trim().is_empty())
    .unwrap_or_else(|| crate::llm2::agent::TOOL_MODEL.to_string());

  println!(
    "[llm2][compact] Manual history compaction triggered for {} messages using model '{}'...",
    messages.len(),
    model_to_use
  );

  compact_full_history(&client, &model_to_use, messages).await
}
