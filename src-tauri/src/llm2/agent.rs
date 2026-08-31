use serde_json::json;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter, Manager};

use super::clients::ollama::{stream_chat_turn, StreamMetrics};
use super::context::prepare_agent_history;
use super::pending::PendingRequests;
use super::tools::{dispatch_tool_call, filter_tools_schema, get_builtin_tools_schema};
use crate::mcp_client::McpClientManager;

pub const TOOL_MODEL: &str = "qwen3.5:4b";
pub const CONTENT_MODEL: &str = "gemma2:9b";
pub const NUM_CTX: usize = 16384;
pub const MAX_AGENT_TURNS: usize = 15;

#[allow(unused_imports)]
pub use super::system_prompt::build_system_prompt;
pub use super::types::OllamaMessage;

/// Primary orchestrator for the LLM2 agent.
/// Handles context preparation, Ollama streaming turns, and tool dispatching.
pub async fn prompt_agent(
  app: AppHandle,
  pending: PendingRequests,
  prompt: &str,
  model_name: Option<String>,
  content_model: Option<String>,
  message_id: Option<String>,
  initial_history: Option<Vec<OllamaMessage>>,
  num_ctx: Option<usize>,
  system_prompt_addendum: Option<String>,
  allowed_tools: Option<Vec<String>>,
  think: Option<bool>,
) -> Result<String, String> {
  let model_to_use = model_name
    .filter(|s| !s.trim().is_empty())
    .unwrap_or_else(|| TOOL_MODEL.to_string());
  let content_model_to_use = content_model
    .filter(|s| !s.trim().is_empty())
    .unwrap_or_else(|| CONTENT_MODEL.to_string());
  let num_ctx_to_use = num_ctx.unwrap_or(NUM_CTX);

  println!(
    "[llm2][agent] Starting prompt with tool model '{}' (content model '{}', num_ctx {}): {:?}",
    model_to_use, content_model_to_use, num_ctx_to_use, prompt
  );

  let cancel_flag = match &message_id {
    Some(id) => pending.register_cancel(id),
    None => pending.register_cancel("default"),
  };

  let client = reqwest::Client::new();
  let mcp_manager = app.try_state::<McpClientManager>();

  // 1. Build and filter tool schemas
  let mut all_tools_vec = get_builtin_tools_schema(&content_model_to_use)
    .as_array()
    .cloned()
    .unwrap_or_default();

  if let Some(mgr) = &mcp_manager {
    let mcp_tools = mgr.get_ollama_tools().await;
    if !mcp_tools.is_empty() {
      println!("[llm2][agent] Injected {} external MCP tools into Ollama schema.", mcp_tools.len());
      all_tools_vec.extend(mcp_tools);
    }
  }

  let effective_tools_schema = filter_tools_schema(json!(all_tools_vec), allowed_tools.as_ref());

  // 2. Prepare optimized conversation history & apply sliding window budgeting
  let (mut history, sliding_res) = prepare_agent_history(
    &model_to_use,
    &content_model_to_use,
    prompt,
    initial_history,
    system_prompt_addendum,
    mcp_manager.as_deref(),
    num_ctx_to_use,
    Some(&effective_tools_schema),
  )
  .await;

  if sliding_res.pruned_turns > 0 {
    if let Some(msg_id) = &message_id {
      let _ = app.emit(
        "llm2_sliding_window",
        json!({
          "message_id": msg_id,
          "pruned_turns": sliding_res.pruned_turns,
          "retained_turns": sliding_res.retained_turns,
          "num_ctx": num_ctx_to_use,
          "estimated_tokens": sliding_res.estimated_tokens,
        }),
      );
    }
  }

  let mut accumulated_final_text = String::new();
  let mut metrics = StreamMetrics {
    accumulated_eval_tokens: 0,
    latest_prompt_tokens: 0,
  };

  // 3. Multi-turn streaming resolution loop
  for turn in 0..MAX_AGENT_TURNS {
    if cancel_flag.load(Ordering::Relaxed) || pending.is_cancelled(message_id.as_deref()) {
      println!("[llm2][turn {}] 🛑 Generation cancelled by user.", turn);
      if let Some(msg_id) = &message_id {
        let _ = app.emit("llm2_done", json!({
          "message_id": msg_id,
          "content": accumulated_final_text,
          "cancelled": true,
        }));
        pending.remove_cancel(msg_id);
      }
      return Ok(accumulated_final_text);
    }

    let stream_result = stream_chat_turn(
      &client,
      &app,
      &pending,
      &cancel_flag,
      &model_to_use,
      &history,
      &effective_tools_schema,
      think,
      num_ctx_to_use,
      message_id.as_deref(),
      turn,
      &mut metrics,
    )
    .await?;

    if stream_result.cancelled {
      if let Some(msg_id) = &message_id {
        let _ = app.emit("llm2_done", json!({
          "message_id": msg_id,
          "content": stream_result.turn_text,
          "cancelled": true,
        }));
        pending.remove_cancel(msg_id);
      }
      return Ok(stream_result.turn_text);
    }

    // 4. Handle Tool Calls if any were requested
    if !stream_result.tool_calls.is_empty() {
      history.push(OllamaMessage {
        role: "assistant".to_string(),
        content: stream_result.turn_text.clone(),
        tool_calls: Some(stream_result.tool_calls.clone()),
      });

      for tool_call in stream_result.tool_calls {
        if cancel_flag.load(Ordering::Relaxed) || pending.is_cancelled(message_id.as_deref()) {
          println!("[llm2] 🛑 Tool execution cancelled by user.");
          break;
        }

        let call_name = tool_call.function.name;
        let call_args = tool_call.function.arguments;

        let tool_execution_result = dispatch_tool_call(
          &app,
          &pending,
          mcp_manager.as_deref(),
          &content_model_to_use,
          &call_name,
          call_args,
        )
        .await;

        let tool_result_value = match tool_execution_result {
          Ok(val) => {
            println!("[llm2][tool_result] Tool '{}' succeeded.", call_name);
            val
          }
          Err(err) => {
            println!("[llm2][tool_result] Tool '{}' failed: {}. Feeding error to model.", call_name, err);
            json!({ "error": err })
          }
        };

        // Push truncated, clean tool result into history for the next turn
        let raw_tool_str = serde_json::to_string(&tool_result_value).unwrap_or_default();
        let safe_tool_str = super::context::truncate_tool_payload(&raw_tool_str, super::context::MAX_TOOL_PAYLOAD_CHARS);

        history.push(OllamaMessage {
          role: "tool".to_string(),
          content: safe_tool_str,
          tool_calls: None,
        });
      }

      continue;
    }

    // 5. Final text response reached
    accumulated_final_text = stream_result.turn_text;
    break;
  }

  if let Some(msg_id) = &message_id {
    let _ = app.emit("llm2_done", json!({
      "message_id": msg_id,
      "content": accumulated_final_text,
    }));
    pending.remove_cancel(msg_id);
  }

  Ok(accumulated_final_text)
}
