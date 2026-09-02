use tauri::command;

use crate::llm2::router::{fast_triage, ClassificationResult, DEFAULT_TRIAGE_MODEL};

#[command]
pub async fn llm2_classify_intent(
  prompt: String,
  model: Option<String>,
  enable_categories: Option<bool>,
  enable_filter: Option<bool>,
) -> Result<ClassificationResult, String> {
  let triage_model = model
    .filter(|m| !m.trim().is_empty())
    .unwrap_or_else(|| DEFAULT_TRIAGE_MODEL.to_string());

  let client = reqwest::Client::new();
  fast_triage(&client, &triage_model, &prompt, enable_categories, enable_filter).await
}
