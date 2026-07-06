use async_trait::async_trait;
use std::sync::Arc;
use serde_json::Value;
use super::LlmProvider;
use super::super::provider::LlmConfig;
use super::super::remote::ChatMessage;
use super::super::remote;
use super::super::tools;

pub struct ClaudeProvider;

#[async_trait]
impl LlmProvider for ClaudeProvider {
    async fn generate(&self, prompt: &str, config: &LlmConfig) -> Result<String, String> {
        let key = config
            .api_key
            .clone()
            .ok_or("No Claude API key configured")?;
        let model = config
            .model_name
            .clone()
            .unwrap_or_else(|| "claude-3-5-sonnet-20241022".to_string());

        println!("[llm][claude] Generating response using model '{}'", model);
        let result = call_claude_single(&key, &model, prompt).await?;
        println!("[llm][claude] Generation completed successfully ({} chars)", result.len());
        Ok(result)
    }

    async fn stream(
        &self,
        messages: &[ChatMessage],
        config: &LlmConfig,
        app: &tauri::AppHandle,
        cancel: Arc<std::sync::atomic::AtomicBool>,
    ) -> Result<(), String> {
        let key = config
            .api_key
            .clone()
            .ok_or("No API key configured for Claude")?;
        let model = config
            .model_name
            .clone()
            .unwrap_or_else(|| "claude-3-5-sonnet-20241022".to_string());
        let tool_defs = tools::get_tool_definitions();

        println!("[llm][claude] Streaming chat response using model '{}'", model);
        remote::stream_claude(
            &key,
            &model,
            messages,
            config.system_prompt.as_deref(),
            &tool_defs,
            app,
            cancel,
        )
        .await?;

        println!("[llm][claude] Stream completed");
        Ok(())
    }
}

/// Single (non-streaming) Claude API call.
async fn call_claude_single(api_key: &str, model: &str, prompt: &str) -> Result<String, String> {
    use serde_json::json;

    let client = reqwest::Client::new();
    let body = json!({
        "model": model,
        "max_tokens": 2048,
        "messages": [{"role": "user", "content": prompt}],
    });

    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Claude HTTP {}: {}", status, text));
    }

    let json: Value = resp.json().await.map_err(|e| e.to_string())?;
    json["content"][0]["text"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "No content in Claude response".to_string())
}
