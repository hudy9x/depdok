pub mod builder;
pub mod emitter;
pub mod parser;
pub mod types;

pub use builder::OllamaChatRequestBuilder;
pub use emitter::StreamEventEmitter;
pub use parser::OllamaChunkParser;
pub use types::{ParsedChunk, StreamMetrics, StreamTurnResult};

use futures_util::StreamExt;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::AppHandle;

use crate::llm2::pending::PendingRequests;
use crate::llm2::types::{OllamaMessage, OllamaToolCall};

/// Primary facade for streaming a conversation turn with an Ollama instance.
pub async fn stream_chat_turn(
  client: &reqwest::Client,
  app: &AppHandle,
  pending: &PendingRequests,
  cancel_flag: &Arc<AtomicBool>,
  model_name: &str,
  history: &[OllamaMessage],
  tools_schema: &serde_json::Value,
  think: Option<bool>,
  num_ctx: usize,
  message_id: Option<&str>,
  turn: usize,
  metrics: &mut StreamMetrics,
) -> Result<StreamTurnResult, String> {
  let emitter = StreamEventEmitter::new(
    app.clone(),
    pending.clone(),
    cancel_flag.clone(),
    message_id.map(|s| s.to_string()),
    num_ctx,
  );

  let request_body = OllamaChatRequestBuilder::new(model_name)
    .messages(history)
    .tools(tools_schema)
    .think(think)
    .num_ctx(num_ctx)
    .temperature(0.2)
    .build();

  let tool_names: Vec<String> = tools_schema
    .as_array()
    .map(|arr| {
      arr
        .iter()
        .filter_map(|t| t.get("function").and_then(|f| f.get("name")).and_then(|n| n.as_str()))
        .map(|s| s.to_string())
        .collect()
    })
    .unwrap_or_default();

  println!("\n════════════════════ [llm2][turn {}] REQUEST TO OLLAMA ════════════════════", turn);
  println!("1. Model: {}", model_name);
  println!("2. Tools ({}): {}", tool_names.len(), tool_names.join(", "));
  if let Ok(pretty_messages) = serde_json::to_string_pretty(&history) {
    println!("3. Messages:\n{}", pretty_messages);
  } else {
    println!("3. Messages: {:?}", history);
  }
  println!("────────────────────────────────────────────────────────────────────────────");

  // Check model residency status
  crate::llm2::warmup::check_and_notify_model_status(client, app, model_name, message_id, turn).await;

  println!("[llm2][turn {}] ⏳ Sending request to Ollama (http://localhost:11434/api/chat)...", turn);
  let req_start_time = std::time::Instant::now();
  let res = match client
    .post("http://localhost:11434/api/chat")
    .json(&request_body)
    .send()
    .await
  {
    Ok(r) => r,
    Err(e) => {
      return Err(format!("Failed to connect to Ollama at http://localhost:11434: {}", e));
    }
  };

  let status = res.status();
  if !status.is_success() {
    let err_text = res.text().await.unwrap_or_default();
    return Err(format!("Ollama HTTP {}: {}", status, err_text));
  }

  println!(
    "[llm2][turn {}] 📡 HTTP 200 received in {:.2}s. Awaiting stream chunks from Ollama...",
    turn,
    req_start_time.elapsed().as_secs_f64()
  );

  let mut turn_text = String::new();
  let mut collected_tool_calls: Vec<OllamaToolCall> = Vec::new();
  let mut stream_token_count = 0usize;
  let mut thinking_token_count = 0usize;
  let mut first_chunk = true;

  let mut stream = res.bytes_stream();
  let mut parser = OllamaChunkParser::new();

  while let Some(chunk_res) = stream.next().await {
    if emitter.is_cancelled() {
      println!("[llm2][turn {}] 🛑 Stream reading cancelled by user.", turn);
      return Ok(StreamTurnResult {
        turn_text,
        tool_calls: Vec::new(),
        cancelled: true,
      });
    }

    let chunk = match chunk_res {
      Ok(c) => c,
      Err(e) => {
        eprintln!("[llm2][turn {}] Error reading stream chunk: {}", turn, e);
        break;
      }
    };

    let events = parser.feed(&chunk);
    for event in events {
      if first_chunk {
        println!(
          "[llm2][turn {}] ⚡ First stream chunk received in {:.2}s. Streaming live output:",
          turn,
          req_start_time.elapsed().as_secs_f64()
        );
        first_chunk = false;
        emitter.on_status("streaming", model_name, "Streaming response...");
      }

      match event {
        ParsedChunk::Token(token) => {
          stream_token_count += 1;
          turn_text.push_str(&token);
          emitter.on_token(&token);
        }
        ParsedChunk::Thought(thought) => {
          thinking_token_count += 1;
          turn_text.push_str(&thought);
          emitter.on_thought(&thought);
        }
        ParsedChunk::ToolCall(tool_call) => {
          println!(
            "\n[llm2][turn {}] 🔧 Tool Call parsed in stream: {} with args: {:?}",
            turn, tool_call.function.name, tool_call.function.arguments
          );
          collected_tool_calls.push(tool_call);
        }
        ParsedChunk::Done {
          prompt_eval_count,
          eval_count,
        } => {
          println!(
            "\n[llm2][turn {}] 🏁 Stream done chunk. prompt_eval_count: {}, eval_count: {}, total_streamed_chunks: {}",
            turn, prompt_eval_count, eval_count, stream_token_count + thinking_token_count
          );
          if prompt_eval_count > 0 || eval_count > 0 {
            emitter.on_metrics(metrics, prompt_eval_count, eval_count);
          }
        }
      }
    }
  }

  // Process any remaining bytes in parser
  let remaining_events = parser.flush();
  for event in remaining_events {
    match event {
      ParsedChunk::Token(token) => {
        stream_token_count += 1;
        turn_text.push_str(&token);
        emitter.on_token(&token);
      }
      ParsedChunk::Thought(thought) => {
        thinking_token_count += 1;
        turn_text.push_str(&thought);
        emitter.on_thought(&thought);
      }
      ParsedChunk::ToolCall(tool_call) => {
        println!(
          "\n[llm2][turn {}] 🔧 Tool Call parsed in stream: {} with args: {:?}",
          turn, tool_call.function.name, tool_call.function.arguments
        );
        collected_tool_calls.push(tool_call);
      }
      ParsedChunk::Done {
        prompt_eval_count,
        eval_count,
      } => {
        if prompt_eval_count > 0 || eval_count > 0 {
          emitter.on_metrics(metrics, prompt_eval_count, eval_count);
        }
      }
    }
  }

  println!("\n════════════════════ [llm2][turn {}] RESPONSE FROM OLLAMA ════════════════════", turn);
  println!(
    "Elapsed time: {:.2}s | Streamed chunks: {} (thinking: {}) | Text delta (len {}):\n{}",
    req_start_time.elapsed().as_secs_f64(),
    stream_token_count,
    thinking_token_count,
    turn_text.len(),
    if turn_text.is_empty() { "<empty>" } else { &turn_text }
  );
  if !collected_tool_calls.is_empty() {
    if let Ok(pretty_tc) = serde_json::to_string_pretty(&collected_tool_calls) {
      println!("Tool Calls (count {}):\n{}", collected_tool_calls.len(), pretty_tc);
    } else {
      println!("Tool Calls (count {}): {:?}", collected_tool_calls.len(), collected_tool_calls);
    }
  }
  println!("────────────────────────────────────────────────────────────────────────────");

  Ok(StreamTurnResult {
    turn_text,
    tool_calls: collected_tool_calls,
    cancelled: false,
  })
}
