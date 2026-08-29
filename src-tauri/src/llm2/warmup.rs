use reqwest::Client;
use serde_json::json;
use tauri::{AppHandle, Emitter};

/// Checks if a model is currently loaded in Ollama's RAM/VRAM via `GET /api/ps`.
pub async fn is_model_loaded_in_ollama(client: &Client, model_name: &str) -> bool {
  if let Ok(ps_res) = client
    .get("http://localhost:11434/api/ps")
    .timeout(std::time::Duration::from_millis(800))
    .send()
    .await
  {
    if let Ok(ps_json) = ps_res.json::<serde_json::Value>().await {
      if let Some(models_arr) = ps_json.get("models").and_then(|m| m.as_array()) {
        for m in models_arr {
          let loaded_name = m.get("name").and_then(|n| n.as_str()).unwrap_or("");
          let loaded_model = m.get("model").and_then(|n| n.as_str()).unwrap_or("");
          if loaded_name == model_name
            || loaded_model == model_name
            || loaded_name.starts_with(&format!("{}:", model_name))
            || model_name.starts_with(&format!("{}:", loaded_name))
            || format!("{}:latest", model_name) == loaded_name
            || format!("{}:latest", loaded_name) == model_name
          {
            return true;
          }
        }
      }
    }
  }
  false
}

/// Checks model residency and emits the appropriate `llm2_status` event to the frontend.
pub async fn check_and_notify_model_status(
  client: &Client,
  app: &AppHandle,
  model_name: &str,
  message_id: Option<&str>,
  turn: usize,
) -> bool {
  let model_is_loaded = is_model_loaded_in_ollama(client, model_name).await;

  if let Some(msg_id) = message_id {
    if !model_is_loaded {
      println!(
        "[llm2][turn {}] 🔄 Model '{}' not loaded in Ollama RAM. Model will be loaded from disk...",
        turn, model_name
      );
      let _ = app.emit(
        "llm2_status",
        json!({
          "message_id": msg_id,
          "phase": "loading_model",
          "model": model_name,
          "message": format!("Ollama is loading {} model. Please wait...", model_name),
        }),
      );
    } else {
      let _ = app.emit(
        "llm2_status",
        json!({
          "message_id": msg_id,
          "phase": "synthesizing",
          "model": model_name,
          "message": "Synthesizing response...",
        }),
      );
    }
  }

  model_is_loaded
}
