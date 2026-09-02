use serde_json::json;
use super::toolsets::Toolset;

/// Layer 2: Coarse Category Triage.
/// Quickly categorizes the prompt into high-level toolsets (FILE, FOLDER, KNOWLEDGE, WEB, SHELL, SPREADSHEET, NONE)
/// using non-streaming Ollama chat.
pub async fn classify_categories(
  client: &reqwest::Client,
  model: &str,
  trimmed_prompt: &str,
) -> Result<(Vec<Toolset>, String), String> {
  let triage_prompt = format!(
    "You are a tool router. Select ALL relevant tool categories needed to fulfill the user request.\n\
    Available categories:\n\
    - FILE: Creating, reading, editing, or saving files and markdown content.\n\
    - FOLDER: Creating, listing, moving, deleting, or renaming folders/directories.\n\
    - KNOWLEDGE: Searching workspace documentation, notes, or local codebase.\n\
    - WEB: Searching the internet, web browsing, or fetching URL pages.\n\
    - SHELL: Running terminal, git, bash, or CLI commands.\n\
    - SPREADSHEET: Excel/CSV tables, sheets, cells, formulas.\n\
    - NONE: Pure conversation, general questions, explanations without local operations or web search.\n\n\
    Rules:\n\
    - List all needed categories separated by commas (e.g. \"FILE, FOLDER\" or \"WEB, FILE\").\n\n\
    Request: \"{}\"\n\
    Categories:",
    trimmed_prompt
  );

  let request_body = json!({
    "model": model,
    "messages": [
      {
        "role": "user",
        "content": triage_prompt
      }
    ],
    "stream": false,
    "think": false,
    "options": {
      "temperature": 0.0,
      "num_predict": 15
    }
  });

  let res = client
    .post("http://localhost:11434/api/chat")
    .json(&request_body)
    .send()
    .await
    .map_err(|e| format!("Fast triage connection error: {}", e))?;

  let status = res.status();
  if !status.is_success() {
    let err_text = res
      .text()
      .await
      .unwrap_or_else(|_| "Unknown HTTP error".to_string());
    return Err(format!("Ollama category triage failed (HTTP {}): {}", status, err_text));
  }

  let resp_json: serde_json::Value = res
    .json()
    .await
    .map_err(|e| format!("Failed to parse triage response JSON: {}", e))?;

  let raw_output = resp_json
    .get("message")
    .and_then(|m| m.get("content"))
    .and_then(|c| c.as_str())
    .unwrap_or("ALL")
    .trim()
    .to_string();

  let toolsets = Toolset::from_multi_label(&raw_output);
  Ok((toolsets, raw_output))
}
