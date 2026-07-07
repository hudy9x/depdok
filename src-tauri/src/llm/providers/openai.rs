use async_trait::async_trait;
use std::sync::Arc;
use serde_json::Value;
use super::LlmProvider;
use super::super::provider::LlmConfig;
use super::super::remote::ChatMessage;
use super::super::remote;
use super::super::tools;

pub struct OpenAiProvider;

#[async_trait]
impl LlmProvider for OpenAiProvider {
    async fn generate(&self, prompt: &str, config: &LlmConfig) -> Result<String, String> {
        let endpoint = config
            .api_endpoint
            .clone()
            .unwrap_or_else(|| "https://api.openai.com".to_string());
        let model = config.model_name.clone().unwrap_or_else(|| "gpt-4o".to_string());
        let key = config.api_key.clone();

        println!("[llm][openai] Generating response using model '{}' at endpoint '{}'", model, endpoint);
        let result = call_openai_compat_single(&endpoint, &model, key.as_deref(), prompt).await?;
        println!("[llm][openai] Generation completed successfully ({} chars)", result.len());
        Ok(result)
    }

    async fn stream(
        &self,
        messages: &[ChatMessage],
        config: &LlmConfig,
        app: &tauri::AppHandle,
        cancel: Arc<std::sync::atomic::AtomicBool>,
    ) -> Result<(), String> {
        let endpoint = config
            .api_endpoint
            .clone()
            .unwrap_or_else(|| "https://api.openai.com".to_string());
        let model = config.model_name.clone().unwrap_or_else(|| "gpt-4o".to_string());
        let key = config.api_key.clone();
        let tool_defs = tools::get_tool_definitions();

        println!("[llm][openai] Streaming chat response using model '{}' at endpoint '{}'", model, endpoint);
        remote::stream_openai_compatible(
            &endpoint,
            &model,
            key.as_deref(),
            messages,
            &tool_defs,
            app,
            cancel,
        )
        .await?;

        println!("[llm][openai] Stream completed");
        Ok(())
    }
}

/// Single (non-streaming) OpenAI-compatible chat completion.
async fn call_openai_compat_single(
    endpoint: &str,
    model: &str,
    api_key: Option<&str>,
    prompt: &str,
) -> Result<String, String> {
    use serde_json::json;

    let client = reqwest::Client::new();
    let url = format!("{}/v1/chat/completions", endpoint.trim_end_matches('/'));

    let body = json!({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": false,
    });

    let mut req = client.post(&url).json(&body);
    if let Some(key) = api_key {
        if !key.is_empty() {
            req = req.bearer_auth(key);
        }
    }

    let resp = req.send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, text));
    }

    let json: Value = resp.json().await.map_err(|e| e.to_string())?;
    json["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "No content in response".to_string())
}
