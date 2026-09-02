use serde_json::json;
use std::io::Write;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

use crate::llm2::runtime::PendingRequests;
use super::types::StreamMetrics;

/// Emitter and observer for live tokens, thinking thoughts, token usage metrics, and cancellation.
pub struct StreamEventEmitter {
  app: AppHandle,
  pending: PendingRequests,
  cancel_flag: Arc<AtomicBool>,
  message_id: Option<String>,
  num_ctx: usize,
}

impl StreamEventEmitter {
  pub fn new(
    app: AppHandle,
    pending: PendingRequests,
    cancel_flag: Arc<AtomicBool>,
    message_id: Option<String>,
    num_ctx: usize,
  ) -> Self {
    Self {
      app,
      pending,
      cancel_flag,
      message_id,
      num_ctx,
    }
  }

  pub fn is_cancelled(&self) -> bool {
    self.cancel_flag.load(Ordering::Relaxed)
      || self.pending.is_cancelled(self.message_id.as_deref())
  }

  pub fn on_token(&self, content: &str) {
    print!("{}", content);
    std::io::stdout().flush().ok();

    if let Some(msg_id) = &self.message_id {
      let _ = self.app.emit("llm2_token", json!({
        "message_id": msg_id,
        "chunk": content,
      }));
    }
  }

  pub fn on_thought(&self, thinking: &str) {
    print!("{}", thinking);
    std::io::stdout().flush().ok();

    if let Some(msg_id) = &self.message_id {
      let _ = self.app.emit("llm2_thought", json!({
        "message_id": msg_id,
        "chunk": thinking,
      }));
    }
  }

  pub fn on_metrics(&self, metrics: &mut StreamMetrics, prompt_eval: u64, eval: u64) {
    if prompt_eval > 0 {
      metrics.latest_prompt_tokens = prompt_eval;
    }
    metrics.accumulated_eval_tokens += eval;

    let total = metrics.latest_prompt_tokens + metrics.accumulated_eval_tokens;
    let percent = (total as f64 / self.num_ctx as f64) * 100.0;

    if let Some(msg_id) = &self.message_id {
      let _ = self.app.emit("llm2_metrics", json!({
        "message_id": msg_id,
        "prompt_tokens": metrics.latest_prompt_tokens,
        "completion_tokens": metrics.accumulated_eval_tokens,
        "total_tokens": total,
        "num_ctx": self.num_ctx,
        "percent_consumed": (percent * 10.0).round() / 10.0,
        "remaining_tokens": self.num_ctx.saturating_sub(total as usize),
      }));
    }
  }

  pub fn on_status(&self, phase: &str, model: &str, message: &str) {
    if let Some(msg_id) = &self.message_id {
      let _ = self.app.emit(
        "llm2_status",
        json!({
          "message_id": msg_id,
          "phase": phase,
          "model": model,
          "message": message,
        }),
      );
    }
  }

  #[allow(dead_code)]
  pub fn on_done(&self, final_text: &str, cancelled: bool) {
    if let Some(msg_id) = &self.message_id {
      let _ = self.app.emit("llm2_done", json!({
        "message_id": msg_id,
        "content": final_text,
        "cancelled": cancelled,
      }));
      self.pending.remove_cancel(msg_id);
    }
  }
}
