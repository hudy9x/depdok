// This module is only compiled when the `openai-embeddings` feature is enabled.
// To activate: add `--features openai-embeddings` to your cargo build command,
// or set `features = ["openai-embeddings"]` in the workspace Cargo.toml.
//
// Integration notes:
// - An OpenAI API key must be provided at runtime (read from app settings — never hard-coded).
// - Each `embed()` call performs an async HTTP request.
// - `text-embedding-3-large` produces 3072 dimensions. The vec0 table is created with the
//   dimension count from `Embedder::dimensions()`, so switching providers requires
//   re-initialising (or migrating) the database.

#[cfg(feature = "openai-embeddings")]
use super::Embedder;
#[cfg(feature = "openai-embeddings")]
use async_trait::async_trait;

#[cfg(feature = "openai-embeddings")]
pub struct OpenAiProvider {
    client: reqwest::Client,
    api_key: String,
    /// Model identifier, e.g. `"text-embedding-3-large"`.
    model: String,
    /// Dimension count; `text-embedding-3-large` defaults to 3072.
    dimensions: usize,
}

#[cfg(feature = "openai-embeddings")]
impl OpenAiProvider {
    pub fn new(api_key: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            api_key,
            model: "text-embedding-3-large".to_string(),
            dimensions: 3072,
        }
    }

    /// Override the model / dimension count if you want a smaller variant
    /// (OpenAI supports reduced dimensions via the `dimensions` request param).
    pub fn with_model(mut self, model: impl Into<String>, dimensions: usize) -> Self {
        self.model = model.into();
        self.dimensions = dimensions;
        self
    }
}

#[cfg(feature = "openai-embeddings")]
#[async_trait]
impl Embedder for OpenAiProvider {
    async fn embed(&self, text: &str) -> Result<Vec<f32>, String> {
        let body = serde_json::json!({
            "input": text,
            "model": self.model,
        });

        let response = self.client
            .post("https://api.openai.com/v1/embeddings")
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("OpenAI request failed: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("OpenAI API error {status}: {body}"));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse OpenAI response: {e}"))?;

        let embedding = json["data"][0]["embedding"]
            .as_array()
            .ok_or_else(|| "Missing `data[0].embedding` in OpenAI response".to_string())?
            .iter()
            .map(|v| {
                v.as_f64()
                    .ok_or_else(|| "Non-numeric value in embedding array".to_string())
                    .map(|f| f as f32)
            })
            .collect::<Result<Vec<f32>, _>>()?;

        Ok(embedding)
    }

    fn dimensions(&self) -> usize {
        self.dimensions
    }

    fn name(&self) -> &'static str {
        "openai/text-embedding-3-large"
    }
}
