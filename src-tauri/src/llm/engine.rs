use llama_cpp_2::{
    context::params::LlamaContextParams,
    llama_backend::LlamaBackend,
    llama_batch::LlamaBatch,
    model::{params::LlamaModelParams, AddBos, LlamaModel},
    sampling::LlamaSampler,
};
use std::ffi::c_void;
use std::num::NonZeroU32;

/// Suppress ALL internal llama.cpp / ggml / Metal logs — installed before backend init.
extern "C" fn noop_log(
    _level: llama_cpp_sys_2::ggml_log_level,
    _text: *const std::ffi::c_char,
    _user_data: *mut c_void,
) {
}

#[derive(Clone)]
pub struct LlamaConfig {
    pub gpu_layers: u32, // u32::MAX = all layers on GPU (Apple Silicon default)
    pub ctx_size: u32,   // KV-cache context window in tokens (default 2048)
    pub max_tokens: i32, // max generated tokens per call (default 512)
    pub silent: bool,    // suppress llama.cpp logs (default true)
}

impl Default for LlamaConfig {
    fn default() -> Self {
        Self {
            gpu_layers: u32::MAX,
            ctx_size: 4096,
            max_tokens: 1024,
            silent: true,
        }
    }
}

#[allow(dead_code)]
impl LlamaConfig {
    pub fn gpu_layers(mut self, v: u32) -> Self {
        self.gpu_layers = v;
        self
    }
    pub fn ctx_size(mut self, v: u32) -> Self {
        self.ctx_size = v;
        self
    }
    pub fn max_tokens(mut self, v: i32) -> Self {
        self.max_tokens = v;
        self
    }
    pub fn silent(mut self, v: bool) -> Self {
        self.silent = v;
        self
    }
}

pub struct LlamaEngine {
    backend: LlamaBackend,
    model: LlamaModel,
    config: LlamaConfig,
}

impl LlamaEngine {
    /// Load a GGUF model. Installs noop_log BEFORE backend init to silence Metal noise.
    pub fn load(
        path: impl AsRef<std::path::Path>,
        config: LlamaConfig,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        if config.silent {
            unsafe {
                llama_cpp_sys_2::llama_log_set(Some(noop_log), std::ptr::null_mut());
            }
        }
        let backend = LlamaBackend::init()?;
        let model_params = LlamaModelParams::default().with_n_gpu_layers(config.gpu_layers);
        let model = LlamaModel::load_from_file(&backend, path, &model_params)?;
        Ok(Self {
            backend,
            model,
            config,
        })
    }

    /// Collect full response as a String (non-streaming).
    pub fn generate(
        &self,
        prompt: &str,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let mut out = String::new();
        self.stream(prompt, |piece| {
            out.push_str(piece);
            Ok(true)
        })?;
        Ok(out)
    }

    /// Stream token-by-token. Return Ok(false) from closure to stop early (cancellation).
    pub fn stream(
        &self,
        prompt: &str,
        mut on_token: impl FnMut(&str) -> Result<bool, Box<dyn std::error::Error + Send + Sync>>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let ctx_params = LlamaContextParams::default()
            .with_n_ctx(Some(NonZeroU32::new(self.config.ctx_size).unwrap()))
            .with_n_batch(self.config.ctx_size);
        let mut ctx = self.model.new_context(&self.backend, ctx_params)?;
        let tokens = self.model.str_to_token(prompt, AddBos::Always)?;
        let mut batch = LlamaBatch::new(tokens.len().max(512), 1);
        let last = (tokens.len() - 1) as i32;
        for (i, &tok) in tokens.iter().enumerate() {
            batch.add(tok, i as i32, &[0], i as i32 == last)?;
        }
        ctx.decode(&mut batch)?;
        let mut sampler = LlamaSampler::greedy();
        let mut decoder = encoding_rs::UTF_8.new_decoder();
        let mut n = batch.n_tokens();
        while n <= self.config.max_tokens {
            let token = sampler.sample(&ctx, -1);
            if self.model.is_eog_token(token) {
                break;
            }
            let piece = self
                .model
                .token_to_piece(token, &mut decoder, false, None)?;
            if !on_token(&piece)? {
                break; // Ok(false) is cancellation signal
            }
            batch.clear();
            batch.add(token, n, &[0], true)?;
            ctx.decode(&mut batch)?;
            n += 1;
        }
        Ok(())
    }
}
