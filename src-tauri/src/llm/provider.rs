use std::sync::{Arc, Mutex};
use std::sync::atomic::AtomicBool;
use serde::{Deserialize, Serialize};

use super::engine::{LlamaConfig, LlamaEngine};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ProviderType {
    Local,
    Ollama,
    LmStudio,
    OpenAI,
    Claude,
}

impl Default for ProviderType {
    fn default() -> Self {
        Self::Local
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmConfig {
    pub provider_type: ProviderType,
    pub local_model_path: Option<String>,
    pub api_endpoint: Option<String>,
    pub api_key: Option<String>,
    pub model_name: Option<String>,
    pub gpu_layers: u32,
    pub ctx_size: u32,
    pub max_tokens: i32,
    pub system_prompt: Option<String>,
}

impl Default for LlmConfig {
    fn default() -> Self {
        Self {
            provider_type: ProviderType::Local,
            local_model_path: None,
            api_endpoint: None,
            api_key: None,
            model_name: None,
            gpu_layers: u32::MAX,
            ctx_size: 4096,
            max_tokens: 1024,
            system_prompt: Some(
                "You are a helpful AI assistant integrated into a code editor. \
                 You have access to tools for reading/writing files, running shell commands, \
                 and searching the web. Use them when helpful."
                    .to_string(),
            ),
        }
    }
}

impl LlmConfig {
    pub fn to_llama_config(&self) -> LlamaConfig {
        LlamaConfig::default()
            .gpu_layers(self.gpu_layers)
            .ctx_size(self.ctx_size)
            .max_tokens(self.max_tokens)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmProviderStatus {
    pub loaded: bool,
    pub provider_type: ProviderType,
    pub model_name: Option<String>,
}

pub struct LlmState {
    /// Local llama.cpp engine; None = not loaded
    pub engine: Mutex<Option<Arc<LlamaEngine>>>,
    /// Current configuration
    pub config: Mutex<LlmConfig>,
    /// Set true to abort current generation stream
    pub cancel: Arc<AtomicBool>,
}

impl LlmState {
    pub fn new() -> Self {
        Self {
            engine: Mutex::new(None),
            config: Mutex::new(LlmConfig::default()),
            cancel: Arc::new(AtomicBool::new(false)),
        }
    }
}
