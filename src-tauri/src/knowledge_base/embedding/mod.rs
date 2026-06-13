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

/// Placeholder embedder used when local models are not yet downloaded.
pub struct DummyEmbedder;

#[async_trait]
impl Embedder for DummyEmbedder {
    async fn embed(&self, _text: &str) -> Result<Vec<f32>, String> {
        Err("No embedding model is downloaded. Please download/select one in Settings first.".to_string())
    }

    fn dimensions(&self) -> usize {
        384
    }

    fn name(&self) -> &'static str {
        "dummy"
    }
}

/// Check if the specified local model is cached/downloaded in the app's cache directory.
pub fn is_model_downloaded(cache_dir: &std::path::Path, model_name: &str) -> bool {
    let search_term = model_name.to_lowercase();
    if let Ok(entries) = std::fs::read_dir(cache_dir) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_dir() {
                    let name = entry.file_name().to_string_lossy().to_lowercase();
                    if name.starts_with("models--") && name.contains(&search_term) {
                        let snapshots_path = entry.path().join("snapshots");
                        if snapshots_path.exists() {
                            if let Ok(snap_entries) = std::fs::read_dir(snapshots_path) {
                                for snap_entry in snap_entries.flatten() {
                                    if let Ok(snap_type) = snap_entry.file_type() {
                                        if snap_type.is_dir() {
                                            if let Ok(files) = std::fs::read_dir(snap_entry.path()) {
                                                for file in files.flatten() {
                                                    if let Some(ext) = file.path().extension() {
                                                        if ext == "onnx" {
                                                            return true;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    false
}

/// Select and initialise the active embedder provider with defaults.
pub fn init_embedder(cache_dir: Option<PathBuf>) -> Result<Box<dyn Embedder>, String> {
    init_embedder_with_config(cache_dir, "local", "all-MiniLM-L6-v2", None, true)
}

/// Select and initialise the active embedder provider with explicit configuration.
pub fn init_embedder_with_config(
    cache_dir: Option<PathBuf>,
    model_type: &str,
    model_name: &str,
    openai_key: Option<String>,
    force_download: bool,
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
        let is_downloaded = if let Some(ref cache) = cache_dir {
            is_model_downloaded(cache, model_name)
        } else {
            false
        };

        if !is_downloaded && !force_download {
            return Ok(Box::new(DummyEmbedder));
        }

        let provider = fastembed::FastEmbedProvider::new_with_model(cache_dir, model_name)?;
        Ok(Box::new(provider))
    }
}

