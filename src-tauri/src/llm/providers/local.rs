use async_trait::async_trait;
use std::sync::Arc;
use tauri::Emitter;
use super::LlmProvider;
use super::super::provider::LlmConfig;
use super::super::remote::ChatMessage;
use super::super::engine::LlamaEngine;

pub struct LocalProvider {
    engine: Arc<LlamaEngine>,
}

impl LocalProvider {
    pub fn new(engine: Arc<LlamaEngine>) -> Self {
        Self { engine }
    }
}

#[async_trait]
impl LlmProvider for LocalProvider {
    async fn generate(&self, prompt: &str, config: &LlmConfig) -> Result<String, String> {
        let system_prompt = config.system_prompt.as_deref();
        let formatted_prompt = wrap_generate_prompt(prompt, system_prompt);
        println!("[llm][local] Generating response for prompt ({} chars)", formatted_prompt.len());
        let engine = self.engine.clone();
        
        let result = tokio::task::spawn_blocking(move || {
            engine.generate(&formatted_prompt).map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))??;

        let cleaned_result = clean_model_output(&result);
        println!("[llm][local] Generation completed successfully ({} chars)", cleaned_result.len());
        Ok(cleaned_result)
    }

    async fn stream(
        &self,
        messages: &[ChatMessage],
        config: &LlmConfig,
        app: &tauri::AppHandle,
        cancel: Arc<std::sync::atomic::AtomicBool>,
    ) -> Result<(), String> {
        let prompt = build_chat_prompt(messages, config.system_prompt.as_deref());
        println!("[llm][local] Streaming chat response for prompt ({} chars)", prompt.len());
        
        let engine = self.engine.clone();
        let app_clone = app.clone();
        let cancel_clone = cancel.clone();

        tokio::task::spawn_blocking(move || {
            engine.stream(&prompt, |piece| {
                let _ = app_clone.emit("llm-token", piece);
                Ok(!cancel_clone.load(std::sync::atomic::Ordering::Relaxed))
            })
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
        .map_err(|e| e.to_string())?;

        println!("[llm][local] Stream finished");
        let _ = app.emit("llm-done", ());
        Ok(())
    }
}

fn build_chat_prompt(messages: &[ChatMessage], system_prompt: Option<&str>) -> String {
    let mut prompt = String::new();

    if let Some(sys) = system_prompt {
        prompt.push_str(&format!("<|system|>\n{sys}\n"));
    }

    for msg in messages {
        match msg.role.as_str() {
            "user" => prompt.push_str(&format!("<|user|>\n{}\n<|assistant|>\n", msg.content)),
            "assistant" => prompt.push_str(&format!("{}\n", msg.content)),
            _ => {}
        }
    }

    prompt
}

fn wrap_generate_prompt(prompt: &str, system_prompt: Option<&str>) -> String {
    let mut wrapped = String::new();
    if let Some(sys) = system_prompt {
        wrapped.push_str(&format!("<|system|>\n{sys}\n"));
    }
    wrapped.push_str(&format!("<|user|>\n{prompt}\n<|assistant|>\n"));
    wrapped
}

fn clean_model_output(output: &str) -> String {
    let mut cleaned = output.trim();
    if cleaned.starts_with("<|assistant|>") {
        cleaned = cleaned.trim_start_matches("<|assistant|>").trim();
    }
    if cleaned.ends_with("<|end|>") {
        cleaned = cleaned.trim_end_matches("<|end|>").trim();
    }
    cleaned.to_string()
}
