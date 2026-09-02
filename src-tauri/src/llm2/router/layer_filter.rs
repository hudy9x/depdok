use serde_json::json;

/// Layer 3: Fine-Grained Tool Filtering.
/// Given candidate tools from Layer 2, prunes redundant or irrelevant tools
/// so the model only receives the exact tools needed for execution.
pub async fn filter_redundant_tools(
  client: &reqwest::Client,
  model: &str,
  prompt: &str,
  candidate_tools: &[String],
) -> Vec<String> {
  // If candidates are small enough, no filtering needed
  if candidate_tools.len() <= 3 {
    return candidate_tools.to_vec();
  }

  let candidates_str = candidate_tools.join(", ");
  let filter_prompt = format!(
    "You are an expert tool filter. Given the user request and candidate tools, select ONLY the tools specifically needed to perform and verify the task. Exclude all redundant or irrelevant tools.\n\n\
    Candidates:\n{}\n\n\
    Request: \"{}\"\n\
    Selected tools (separated by comma):",
    candidates_str, prompt
  );

  let request_body = json!({
    "model": model,
    "messages": [
      {
        "role": "user",
        "content": filter_prompt
      }
    ],
    "stream": false,
    "think": false,
    "options": {
      "temperature": 0.0,
      "num_predict": 30
    }
  });

  let res = match client
    .post("http://localhost:11434/api/chat")
    .json(&request_body)
    .send()
    .await
  {
    Ok(r) => r,
    Err(e) => {
      eprintln!("[llm2][router][layer_filter] Connection error: {}", e);
      return candidate_tools.to_vec();
    }
  };

  if !res.status().is_success() {
    return candidate_tools.to_vec();
  }

  let resp_json: serde_json::Value = match res.json().await {
    Ok(j) => j,
    Err(_) => return candidate_tools.to_vec(),
  };

  let raw_output = resp_json
    .get("message")
    .and_then(|m| m.get("content"))
    .and_then(|c| c.as_str())
    .unwrap_or("")
    .trim();

  let mut filtered = Vec::new();
  for token in raw_output.split(|c: char| c == ',' || c == '\n' || c == ';') {
    let clean = token.trim().trim_matches(|c: char| c == '`' || c == '"' || c == '\'');
    for candidate in candidate_tools {
      if candidate.eq_ignore_ascii_case(clean) && !filtered.contains(candidate) {
        filtered.push(candidate.clone());
      }
    }
  }

  if filtered.is_empty() {
    candidate_tools.to_vec()
  } else {
    filtered
  }
}
