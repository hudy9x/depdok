use async_trait::async_trait;
use std::sync::Arc;
use super::provider::{LlmConfig, LlmState, ProviderType};
use super::remote::ChatMessage;
use super::engine::LlamaEngine;

pub mod local;
pub mod openai;
pub mod claude;
pub mod ollama;
pub mod lm_studio;

#[async_trait]
pub trait LlmProvider: Send + Sync {
    /// Generate a single non-streaming completion (e.g. for grammar correction).
    async fn generate(&self, prompt: &str, config: &LlmConfig) -> Result<String, String>;

    /// Stream a completion to the frontend via the `llm-token` event.
    async fn stream(
        &self,
        messages: &[ChatMessage],
        config: &LlmConfig,
        app: &tauri::AppHandle,
        cancel: Arc<std::sync::atomic::AtomicBool>,
    ) -> Result<(), String>;
}

/// Retrieve the active provider instance based on the LLM configuration.
pub async fn get_provider(
    config: &LlmConfig,
    state: &LlmState,
) -> Result<Box<dyn LlmProvider>, String> {
    match config.provider_type {
        ProviderType::Local => {
            let engine = ensure_engine(state).await?;
            Ok(Box::new(local::LocalProvider::new(engine)))
        }
        ProviderType::OpenAI => Ok(Box::new(openai::OpenAiProvider)),
        ProviderType::Claude => Ok(Box::new(claude::ClaudeProvider)),
        ProviderType::Ollama => Ok(Box::new(ollama::OllamaProvider)),
        ProviderType::LmStudio => Ok(Box::new(lm_studio::LmStudioProvider)),
    }
}

/// Ensures the local llama.cpp engine is loaded into memory.
pub async fn ensure_engine(state: &LlmState) -> Result<Arc<LlamaEngine>, String> {
    if let Some(engine) = state.engine.lock().unwrap().clone() {
        return Ok(engine);
    }

    let config = state.config.lock().unwrap().clone();
    if !matches!(config.provider_type, ProviderType::Local) {
        return Err("LLM Provider is not set to Local".to_string());
    }

    let model_path = config
        .local_model_path
        .clone()
        .ok_or("No local model path configured. Please download or select a GGUF model in settings.")?;

    let llama_config = config.to_llama_config();

    println!("[llm] Loading local model on demand from: {}", model_path);
    let engine = tokio::task::spawn_blocking(move || {
        LlamaEngine::load(&model_path, llama_config)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Task error: {}", e))??;

    println!("[llm] Local model loaded successfully into memory");
    let engine_arc = Arc::new(engine);
    *state.engine.lock().unwrap() = Some(Arc::clone(&engine_arc));
    Ok(engine_arc)
}
