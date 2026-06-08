use std::path::PathBuf;

use fastembed::{EmbeddingModel, InitOptions, TextEmbedding};

use super::Embedder;

/// Local, offline embedding provider backed by `fastembed` + ONNX Runtime.
///
/// Uses the `all-MiniLM-L6-v2` model (384 dimensions, ~22 MB).
/// The ONNX model file is downloaded once to `cache_dir` on first launch;
/// subsequent runs are fully offline.
pub struct FastEmbedProvider {
    model: TextEmbedding,
}

impl FastEmbedProvider {
    /// Load (or download) the model.
    ///
    /// `cache_dir`: where the ONNX model is stored. Defaults to the system
    /// cache directory when `None`.
    pub fn new(cache_dir: Option<PathBuf>) -> Result<Self, String> {
        let mut opts = InitOptions::new(EmbeddingModel::AllMiniLML6V2);

        if let Some(dir) = cache_dir {
            opts = opts.with_cache_dir(dir);
        }

        let model = TextEmbedding::try_new(opts)
            .map_err(|e| format!("Failed to initialise fastembed model: {e}"))?;

        Ok(Self { model })
    }
}

impl Embedder for FastEmbedProvider {
    /// Embed a single text snippet and return its 384-dimensional vector.
    fn embed(&self, text: &str) -> Result<Vec<f32>, String> {
        let mut results = self
            .model
            .embed(vec![text], None)
            .map_err(|e| format!("fastembed embed error: {e}"))?;

        results
            .pop()
            .ok_or_else(|| "fastembed returned no embedding".to_string())
    }

    fn dimensions(&self) -> usize {
        384
    }

    fn name(&self) -> &'static str {
        "fastembed/all-MiniLM-L6-v2"
    }
}
