use rig::tool::PortableTool;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use super::bridge::ToolBridgeError;

// 15. GenerateContentTool (Direct Rust execution calling Content Specialist Model e.g. Gemma 2 / Llama 3)
#[derive(Clone)]
pub struct GenerateContentTool {
  pub app: AppHandle,
  pub default_content_model: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct GenerateContentArgs {
  pub topic: String,
  #[serde(default)]
  pub style: Option<String>,
  #[serde(default)]
  pub language: Option<String>,
  #[serde(default)]
  pub content_model: Option<String>,
}

impl PortableTool for GenerateContentTool {
  const NAME: &'static str = "generate_content";
  type Error = ToolBridgeError;
  type Args = GenerateContentArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Delegate long-form Markdown prose, creative writing, rich tutorials, or in-depth document generation to the Content Specialist model.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "topic": { "type": "string", "description": "The topic, instructions, or outline for the content to generate" },
        "style": { "type": "string", "description": "The tone or style (e.g. 'professional tutorial', 'engaging blog post', 'technical report')" },
        "language": { "type": "string", "description": "Target language (e.g. 'English', 'Vietnamese', 'Japanese')" },
        "content_model": { "type": "string", "description": "Optional specific content model name (e.g. 'gemma2:9b', 'llama3.1:8b', 'llama3.2:3b')" }
      },
      "required": ["topic"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    let default_fallback = self.default_content_model.as_deref().unwrap_or("gemma2:9b");
    let content_model = args
      .content_model
      .as_deref()
      .filter(|s| !s.trim().is_empty())
      .unwrap_or(default_fallback);
    let style = args.style.as_deref().unwrap_or("informative and engaging markdown");
    let language = args.language.as_deref().unwrap_or("English");

    let system_prompt = format!(
      "You are an expert creative writer, editor, and documentation specialist.\nWrite rich, engaging, well-structured Markdown content.\nTarget Style: {}\nTarget Language: {}\nProvide high-quality prose with appropriate headers, bullet points, formatting, and clear explanations.",
      style, language
    );
    let user_prompt = format!("Topic / Request:\n{}\n\nPlease generate complete, high-quality markdown content now.", args.topic);

    let log_id = Uuid::new_v4().to_string();
    let request_id = Uuid::new_v4().to_string();

    // Notify frontend tool monitor that generate_content has started
    let _ = self.app.emit("tool_log_event", json!({
      "id": log_id,
      "requestId": request_id,
      "toolName": Self::NAME,
      "args": {
        "topic": args.topic,
        "style": style,
        "language": language,
        "content_model": content_model
      },
      "status": "executing",
      "timestamp": chrono::Utc::now().to_rfc3339()
    }));

    let request_payload = json!({
      "model": content_model,
      "messages": [
        { "role": "system", "content": system_prompt },
        { "role": "user", "content": user_prompt }
      ],
      "stream": false,
      "options": {
        "num_ctx": 8192,
        "temperature": 0.7
      }
    });

    println!("\n════════════════════ [llm2][content_model] REQUEST TO OLLAMA ════════════════════");
    println!("Model: {}", content_model);
    if let Ok(pretty_req) = serde_json::to_string_pretty(&request_payload) {
      println!("Payload:\n{}", pretty_req);
    } else {
      println!("Payload: {:?}", request_payload);
    }
    println!("────────────────────────────────────────────────────────────────────────────");

    let client = reqwest::Client::new();
    let res = client
      .post("http://localhost:11434/api/chat")
      .json(&request_payload)
      .send()
      .await;

    match res {
      Ok(response) => {
        if !response.status().is_success() {
          let status = response.status();
          let err_text = response.text().await.unwrap_or_default();
          let err_msg = format!("Content model ({}) error (HTTP {}): {}", content_model, status, err_text);

          println!("\n════════════════════ [llm2][content_model] ERROR FROM OLLAMA ════════════════════");
          println!("{}", err_msg);
          println!("────────────────────────────────────────────────────────────────────────────");

          let _ = self.app.emit("tool_log_event", json!({
            "id": log_id,
            "requestId": request_id,
            "toolName": Self::NAME,
            "error": err_msg,
            "status": "error",
            "timestamp": chrono::Utc::now().to_rfc3339()
          }));

          return Err(ToolBridgeError(err_msg));
        }

        let body: serde_json::Value = response.json().await.map_err(|e| {
          ToolBridgeError(format!("Failed to parse response from content model: {}", e))
        })?;

        let generated_text = body
          .get("message")
          .and_then(|m| m.get("content"))
          .and_then(|c| c.as_str())
          .unwrap_or_default()
          .to_string();

        println!("\n════════════════════ [llm2][content_model] RESPONSE FROM OLLAMA ════════════════════");
        println!("Generated prose (len {}):\n{}", generated_text.len(), generated_text);
        println!("────────────────────────────────────────────────────────────────────────────");

        let output = json!({
          "topic": args.topic,
          "style": style,
          "language": language,
          "modelUsed": content_model,
          "content": generated_text,
        });

        // Notify frontend tool monitor that generate_content succeeded
        let _ = self.app.emit("tool_log_event", json!({
          "id": log_id,
          "requestId": request_id,
          "toolName": Self::NAME,
          "result": output,
          "status": "success",
          "timestamp": chrono::Utc::now().to_rfc3339()
        }));

        Ok(output)
      }
      Err(e) => {
        let err_msg = format!("Failed to connect to content model ({}): {}", content_model, e);
        let _ = self.app.emit("tool_log_event", json!({
          "id": log_id,
          "requestId": request_id,
          "toolName": Self::NAME,
          "error": err_msg,
          "status": "error",
          "timestamp": chrono::Utc::now().to_rfc3339()
        }));
        Err(ToolBridgeError(err_msg))
      }
    }
  }
}
