use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaModelInfo {
  pub name: String,
  pub size: Option<u64>,
  pub parameter_size: Option<String>,
  pub quantization_level: Option<String>,
}

#[tauri::command]
pub async fn llm2_list_models() -> Result<Vec<OllamaModelInfo>, String> {
  let client = reqwest::Client::new();
  let res = client
    .get("http://localhost:11434/api/tags")
    .send()
    .await
    .map_err(|e| format!("Cannot connect to Ollama (http://localhost:11434): {}", e))?;

  if !res.status().is_success() {
    return Err(format!("Ollama returned HTTP {}", res.status()));
  }

  let val: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
  let mut models = Vec::new();
  if let Some(arr) = val.get("models").and_then(|m| m.as_array()) {
    for item in arr {
      if let Some(name) = item.get("name").and_then(|n| n.as_str()) {
        let size = item.get("size").and_then(|s| s.as_u64());
        let parameter_size = item
          .get("details")
          .and_then(|d| d.get("parameter_size"))
          .and_then(|p| p.as_str())
          .map(|s| s.to_string());
        let quantization_level = item
          .get("details")
          .and_then(|d| d.get("quantization_level"))
          .and_then(|q| q.as_str())
          .map(|s| s.to_string());
        models.push(OllamaModelInfo {
          name: name.to_string(),
          size,
          parameter_size,
          quantization_level,
        });
      }
    }
  }
  Ok(models)
}
