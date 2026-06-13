use std::path::PathBuf;
use async_trait::async_trait;

pub mod chunker;
pub mod fastembed;
pub mod openai;

/// Provider-agnostic embedding interface.
/// Any type implementing this trait can be swapped in as the active provider.
#[async_trait]
pub trait Embedder: Send + Sync {
    /// Embed a single piece of text and return a float vector.
    async fn embed(&self, text: &str) -> Result<Vec<f32>, String>;
    /// Number of dimensions produced by this provider (used when creating the vec0 table).
    fn dimensions(&self) -> usize;
    /// Human-readable provider name for logging / UI.
    #[allow(dead_code)]
    fn name(&self) -> &'static str;
}

use std::sync::Arc;

/// Tauri managed state wrapping the active embedder as a shared trait object.
/// Commands receive `State<'_, EmbedderState>` and never depend on the concrete type.
pub struct EmbedderState(pub Arc<tokio::sync::RwLock<Box<dyn Embedder>>>);

/// Select and initialise the active embedder provider with defaults.
pub fn init_embedder(cache_dir: Option<PathBuf>) -> Result<Box<dyn Embedder>, String> {
    init_embedder_with_config(cache_dir, "local", "all-MiniLM-L6-v2", None)
}

/// Select and initialise the active embedder provider with explicit configuration.
pub fn init_embedder_with_config(
    cache_dir: Option<PathBuf>,
    model_type: &str,
    model_name: &str,
    openai_key: Option<String>,
) -> Result<Box<dyn Embedder>, String> {
    if model_type == "remote" {
        let key = openai_key.unwrap_or_default();
        if key.is_empty() {
            return Err("OpenAI API Key is required for remote models".to_string());
        }
        let dims = match model_name {
            "text-embedding-3-large" => 3072,
            "text-embedding-3-small" => 1536,
            "text-embedding-ada-002" => 1536,
            _ => 1536,
        };
        let provider = openai::OpenAiProvider::new(key)
            .with_model(model_name, dims);
        Ok(Box::new(provider))
    } else {
        let provider = fastembed::FastEmbedProvider::new_with_model(cache_dir, model_name)?;
        Ok(Box::new(provider))
    }
}
