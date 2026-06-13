use std::path::PathBuf;
use std::sync::Arc;
use async_trait::async_trait;
use fastembed::{EmbeddingModel, InitOptions, TextEmbedding};

use super::Embedder;

/// Local, offline embedding provider backed by `fastembed` + ONNX Runtime.
pub struct FastEmbedProvider {
    model: Arc<TextEmbedding>,
    model_name: String,
    dims: usize,
}

impl FastEmbedProvider {
    /// Load (or download) the default model.
    #[allow(dead_code)]
    pub fn new(cache_dir: Option<PathBuf>) -> Result<Self, String> {
        Self::new_with_model(cache_dir, "all-MiniLM-L6-v2")
    }

    /// Load (or download) the specified model.
    pub fn new_with_model(cache_dir: Option<PathBuf>, model_name: &str) -> Result<Self, String> {
        let model_enum = match model_name {
            "all-MiniLM-L6-v2" => EmbeddingModel::AllMiniLML6V2,
            "all-MiniLM-L12-v2" => EmbeddingModel::AllMiniLML12V2,
            "bge-small-en-v1.5" => EmbeddingModel::BGESmallENV15,
            "bge-base-en-v1.5" => EmbeddingModel::BGEBaseENV15,
            "bge-large-en-v1.5" => EmbeddingModel::BGELargeENV15,
            "nomic-embed-text-v1.5" => EmbeddingModel::NomicEmbedTextV15,
            "multilingual-e5-small" => EmbeddingModel::MultilingualE5Small,
            "multilingual-e5-base" => EmbeddingModel::MultilingualE5Base,
            "multilingual-e5-large" => EmbeddingModel::MultilingualE5Large,
            "paraphrase-multilingual-MiniLM-L12-v2" => EmbeddingModel::ParaphraseMLMiniLML12V2,
            "bge-small-zh-v1.5" => EmbeddingModel::BGESmallZHV15,
            "bge-large-zh-v1.5" => EmbeddingModel::BGELargeZHV15,
            _ => EmbeddingModel::AllMiniLML6V2,
        };

        let dims = match model_name {
            "all-MiniLM-L6-v2" => 384,
            "all-MiniLM-L12-v2" => 384,
            "bge-small-en-v1.5" => 384,
            "bge-base-en-v1.5" => 768,
            "bge-large-en-v1.5" => 1024,
            "nomic-embed-text-v1.5" => 768,
            "multilingual-e5-small" => 384,
            "multilingual-e5-base" => 768,
            "multilingual-e5-large" => 1024,
            "paraphrase-multilingual-MiniLM-L12-v2" => 384,
            "bge-small-zh-v1.5" => 512,
            "bge-large-zh-v1.5" => 1024,
            _ => 384,
        };

        let mut opts = InitOptions::new(model_enum);

        if let Some(dir) = cache_dir {
            opts = opts.with_cache_dir(dir);
        }

        let model = TextEmbedding::try_new(opts)
            .map_err(|e| format!("Failed to initialise fastembed model: {e}"))?;

        Ok(Self {
            model: Arc::new(model),
            model_name: model_name.to_string(),
            dims,
        })
    }
}

#[async_trait]
impl Embedder for FastEmbedProvider {
    /// Embed a single text snippet and return its float vector.
    async fn embed(&self, text: &str) -> Result<Vec<f32>, String> {
        let model = self.model.clone();
        let text_owned = text.to_string();
        
        tokio::task::spawn_blocking(move || {
            let mut results = model
                .embed(vec![text_owned], None)
                .map_err(|e| format!("fastembed embed error: {e}"))?;

            results
                .pop()
                .ok_or_else(|| "fastembed returned no embedding".to_string())
        })
        .await
        .map_err(|e| format!("spawn_blocking join error: {e}"))?
    }

    fn dimensions(&self) -> usize {
        self.dims
    }

    fn name(&self) -> &'static str {
        match self.model_name.as_str() {
            "all-MiniLM-L6-v2" => "fastembed/all-MiniLM-L6-v2",
            "all-MiniLM-L12-v2" => "fastembed/all-MiniLM-L12-v2",
            "bge-small-en-v1.5" => "fastembed/bge-small-en-v1.5",
            "bge-base-en-v1.5" => "fastembed/bge-base-en-v1.5",
            "bge-large-en-v1.5" => "fastembed/bge-large-en-v1.5",
            "nomic-embed-text-v1.5" => "fastembed/nomic-embed-text-v1.5",
            "multilingual-e5-small" => "fastembed/multilingual-e5-small",
            "multilingual-e5-base" => "fastembed/multilingual-e5-base",
            "multilingual-e5-large" => "fastembed/multilingual-e5-large",
            "paraphrase-multilingual-MiniLM-L12-v2" => "fastembed/paraphrase-multilingual-MiniLM-L12-v2",
            "bge-small-zh-v1.5" => "fastembed/bge-small-zh-v1.5",
            "bge-large-zh-v1.5" => "fastembed/bge-large-zh-v1.5",
            _ => "fastembed/all-MiniLM-L6-v2",
        }
    }
}
