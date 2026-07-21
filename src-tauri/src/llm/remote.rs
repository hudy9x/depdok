use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use super::tools::ToolDefinition;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,   // "system" | "user" | "assistant" | "tool"
    pub content: String,
    pub name: Option<String>,       // for tool role
    pub tool_call_id: Option<String>, // for tool role
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallEvent {
    pub name: String,
    pub input: Value,
    pub output: String,
}

/// Stream from OpenAI-compatible endpoints (Ollama, LM Studio, OpenAI).
pub async fn stream_openai_compatible(
    endpoint: &str,
    model: &str,
    api_key: Option<&str>,
    messages: &[ChatMessage],
    tools: &[ToolDefinition],
    app: &AppHandle,
    cancel: std::sync::Arc<std::sync::atomic::AtomicBool>,
) -> Result<(), String> {
    let client = Client::new();

    let msgs: Vec<Value> = messages
        .iter()
        .map(|m| {
            let mut obj = json!({
                "role": m.role,
                "content": m.content,
            });
            if let Some(name) = &m.name {
                obj["name"] = json!(name);
            }
            if let Some(id) = &m.tool_call_id {
                obj["tool_call_id"] = json!(id);
            }
            obj
        })
        .collect();

    let mut body = json!({
        "model": model,
        "messages": msgs,
        "stream": true,
    });

    if !tools.is_empty() {
        let tools_json: Vec<Value> = tools
            .iter()
            .map(|t| {
                json!({
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.parameters,
                    }
                })
            })
            .collect();
        body["tools"] = json!(tools_json);
        body["tool_choice"] = json!("auto");
    }

    let url = format!("{}/v1/chat/completions", endpoint.trim_end_matches('/'));

    let mut req = client.post(&url).json(&body);
    if let Some(key) = api_key {
        if !key.is_empty() {
            req = req.bearer_auth(key);
        }
    }

    let response = req.send().await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, text));
    }

    use futures_util::StreamExt;
    let mut stream = response.bytes_stream();

    let mut tool_call_name = String::new();
    let mut tool_call_args = String::new();
    let mut in_tool_call = false;

    while let Some(chunk) = stream.next().await {
        if cancel.load(std::sync::atomic::Ordering::Relaxed) {
            break;
        }

        let bytes = chunk.map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&bytes);

        for line in text.lines() {
            let line = line.trim();
            if line.is_empty() || !line.starts_with("data: ") {
                continue;
            }
            let data = &line["data: ".len()..];
            if data == "[DONE]" {
                break;
            }

            let Ok(parsed) = serde_json::from_str::<Value>(data) else {
                continue;
            };

            let choices = parsed["choices"].as_array().cloned().unwrap_or_default();
            for choice in choices {
                let delta = &choice["delta"];

                // Handle tool calls
                if let Some(tool_calls) = delta["tool_calls"].as_array() {
                    for tc in tool_calls {
                        if let Some(fn_name) = tc["function"]["name"].as_str() {
                            if !fn_name.is_empty() {
                                tool_call_name = fn_name.to_string();
                                in_tool_call = true;
                            }
                        }
                        if let Some(args) = tc["function"]["arguments"].as_str() {
                            tool_call_args.push_str(args);
                        }
                    }
                }

                // Handle regular content tokens
                if let Some(content) = delta["content"].as_str() {
                    if !content.is_empty() {
                        let _ = app.emit("llm-token", content);
                    }
                }
            }
        }
    }

    // If we collected a tool call, emit it (actual execution happens in commands.rs)
    if in_tool_call && !tool_call_name.is_empty() {
        let _ = app.emit(
            "llm-tool-call-pending",
            json!({
                "name": tool_call_name,
                "args": tool_call_args,
            }),
        );
    }

    let _ = app.emit("llm-done", ());
    Ok(())
}

/// Stream from Anthropic Claude API.
pub async fn stream_claude(
    api_key: &str,
    model: &str,
    messages: &[ChatMessage],
    system_prompt: Option<&str>,
    tools: &[ToolDefinition],
    app: &AppHandle,
    cancel: std::sync::Arc<std::sync::atomic::AtomicBool>,
) -> Result<(), String> {
    let client = Client::new();

    // Anthropic uses a different message format — system is a top-level field
    let msgs: Vec<Value> = messages
        .iter()
        .filter(|m| m.role != "system")
        .map(|m| {
            json!({
                "role": m.role,
                "content": m.content,
            })
        })
        .collect();

    let mut body = json!({
        "model": model,
        "max_tokens": 4096,
        "messages": msgs,
        "stream": true,
    });

    if let Some(sys) = system_prompt {
        body["system"] = json!(sys);
    }

    if !tools.is_empty() {
        let tools_json: Vec<Value> = tools
            .iter()
            .map(|t| {
                json!({
                    "name": t.name,
                    "description": t.description,
                    "input_schema": t.parameters,
                })
            })
            .collect();
        body["tools"] = json!(tools_json);
    }

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Claude HTTP {}: {}", status, text));
    }

    use futures_util::StreamExt;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        if cancel.load(std::sync::atomic::Ordering::Relaxed) {
            break;
        }

        let bytes = chunk.map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&bytes);

        for line in text.lines() {
            let line = line.trim();
            if !line.starts_with("data: ") {
                continue;
            }
            let data = &line["data: ".len()..];
            let Ok(parsed) = serde_json::from_str::<Value>(data) else {
                continue;
            };

            if parsed["type"] == "content_block_delta" {
                if let Some(text) = parsed["delta"]["text"].as_str() {
                    if !text.is_empty() {
                        let _ = app.emit("llm-token", text);
                    }
                }
            }
        }
    }

    let _ = app.emit("llm-done", ());
    Ok(())
}
