// This module is only compiled when the `openai-embeddings` feature is enabled.
// To activate: add `--features openai-embeddings` to your cargo build command,
// or set `features = ["openai-embeddings"]` in the workspace Cargo.toml.
//
// Integration notes:
// - An OpenAI API key must be provided at runtime (read from app settings — never hard-coded).
// - Each `embed()` call performs a synchronous HTTP request. For high-throughput use, refactor
//   the Embedder trait to be async.
// - `text-embedding-3-large` produces 3072 dimensions. The vec0 table is created with the
//   dimension count from `Embedder::dimensions()`, so switching providers requires
//   re-initialising (or migrating) the database.

#[cfg(feature = "openai-embeddings")]
use super::Embedder;

#[cfg(feature = "openai-embeddings")]
pub struct OpenAiProvider {
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
impl Embedder for OpenAiProvider {
    fn embed(&self, text: &str) -> Result<Vec<f32>, String> {
        // Uses reqwest blocking client. Requires the `blocking` feature on reqwest.
        // Add to Cargo.toml if not already present:
        //   reqwest = { ..., features = ["json", "blocking", ...] }
        let client = reqwest::blocking::Client::new();

        let body = serde_json::json!({
            "input": text,
            "model": self.model,
        });

        let response = client
            .post("https://api.openai.com/v1/embeddings")
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .map_err(|e| format!("OpenAI request failed: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().unwrap_or_default();
            return Err(format!("OpenAI API error {status}: {body}"));
        }

        let json: serde_json::Value = response
            .json()
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
