use std::path::PathBuf;
use std::sync::Mutex;

pub mod chunker;
pub mod fastembed;
#[cfg(feature = "openai-embeddings")]
pub mod openai;

/// Provider-agnostic embedding interface.
/// Any type implementing this trait can be swapped in as the active provider.
pub trait Embedder: Send + Sync {
    /// Embed a single piece of text and return a float vector.
    fn embed(&self, text: &str) -> Result<Vec<f32>, String>;
    /// Number of dimensions produced by this provider (used when creating the vec0 table).
    fn dimensions(&self) -> usize;
    /// Human-readable provider name for logging / UI.
    #[allow(dead_code)]
    fn name(&self) -> &'static str;
}

/// Tauri managed state wrapping the active embedder as a trait object.
/// Commands receive `State<'_, EmbedderState>` and never depend on the concrete type.
pub struct EmbedderState(pub Mutex<Box<dyn Embedder>>);

/// Select and initialise the active embedder provider.
/// - Default (no feature flags): local `fastembed` provider.
/// - With `openai-embeddings` feature + API key configured: OpenAI provider.
pub fn init_embedder(cache_dir: Option<PathBuf>) -> Result<Box<dyn Embedder>, String> {
    #[cfg(feature = "openai-embeddings")]
    {
        // TODO: read API key from app settings; if present, return OpenAiProvider.
        // Example:
        //   if let Some(key) = read_openai_key_from_settings() {
        //       return Ok(Box::new(openai::OpenAiProvider::new(key)));
        //   }
    }

    let provider = fastembed::FastEmbedProvider::new(cache_dir)?;
    Ok(Box::new(provider))
}
