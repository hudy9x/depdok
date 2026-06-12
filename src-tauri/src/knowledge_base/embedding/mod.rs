use std::path::PathBuf;
use async_trait::async_trait;

pub mod chunker;
pub mod fastembed;
#[cfg(feature = "openai-embeddings")]
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

/// Select and initialise the active embedder provider.
/// - Default (no feature flags): local `fastembed` provider.
/// - With `openai-embeddings` feature + API key configured: OpenAI provider.
pub fn init_embedder(cache_dir: Option<PathBuf>) -> Result<Box<dyn Embedder>, String> {
    #[cfg(feature = "openai-embeddings")]
    {
        // TODO: read API key from app settings; if present, return OpenAiProvider.
    }

    let provider = fastembed::FastEmbedProvider::new(cache_dir)?;
    Ok(Box::new(provider))
}
