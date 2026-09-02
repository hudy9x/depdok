use crate::llm2::types::OllamaMessage;

/// Default fraction of num_ctx allocated for input context history (leaving headroom for generation & tool calls).
pub const INPUT_CONTEXT_BUDGET_RATIO: f64 = 0.75;

#[derive(Debug, Clone)]
pub struct SlidingWindowResult {
  pub messages: Vec<OllamaMessage>,
  pub pruned_turns: usize,
  pub retained_turns: usize,
  pub estimated_tokens: usize,
  pub folded_tools_count: usize,
  pub folded_chars_saved: usize,
}

/// Heuristically estimates the token count of text (approx ~3.5 characters per token for English/Code).
pub fn estimate_tokens(text: &str) -> usize {
  let len = text.len();
  if len == 0 {
    0
  } else {
    // 3.5 chars per token + minimum 1 token
    ((len as f64) / 3.5).ceil() as usize
  }
}

/// Estimates tokens for a single OllamaMessage including tool calls and JSON formatting overhead.
pub fn estimate_message_tokens(msg: &OllamaMessage) -> usize {
  let content_tokens = estimate_tokens(&msg.content);
  let tool_calls_tokens = if let Some(tools) = &msg.tool_calls {
    tools
      .iter()
      .map(|t| {
        let name_tokens = estimate_tokens(&t.function.name);
        let args_tokens = estimate_tokens(&t.function.arguments.to_string());
        name_tokens + args_tokens + 8 // 8 tokens overhead for JSON wrapper
      })
      .sum()
  } else {
    0
  };

  // Role tag + framing overhead (~4 tokens per message)
  content_tokens + tool_calls_tokens + 4
}

/// Estimates the total token overhead for the tool definitions schema injected into Ollama.
pub fn estimate_tools_schema_tokens(tools_schema: Option<&serde_json::Value>) -> usize {
  match tools_schema {
    Some(schema) => {
      let schema_str = schema.to_string();
      estimate_tokens(&schema_str)
    }
    None => 0,
  }
}

/// Applies a sliding window to conversation history based on the dynamic `num_ctx` budget.
/// Always preserves:
/// 1. System prompt (anchor 0)
/// 2. Active user prompt (anchor tail)
///
/// Iterates backwards from newest historical messages to oldest, retaining as many complete
/// messages as fit within the budget. Older turns that exceed the budget are pruned.
pub fn apply_sliding_window(
  system_message: OllamaMessage,
  prior_messages: Vec<OllamaMessage>,
  active_user_prompt: OllamaMessage,
  num_ctx: usize,
  tools_schema: Option<&serde_json::Value>,
) -> SlidingWindowResult {
  let max_allowed_input_tokens = ((num_ctx as f64) * INPUT_CONTEXT_BUDGET_RATIO).floor() as usize;

  let system_tokens = estimate_message_tokens(&system_message);
  let active_prompt_tokens = estimate_message_tokens(&active_user_prompt);
  let tools_overhead = estimate_tools_schema_tokens(tools_schema);

  let baseline_tokens = system_tokens + active_prompt_tokens + tools_overhead;

  // If even baseline exceeds budget (very small num_ctx), return minimal anchor messages
  if baseline_tokens >= max_allowed_input_tokens || prior_messages.is_empty() {
    let pruned = prior_messages.len();
    return SlidingWindowResult {
      messages: vec![system_message, active_user_prompt],
      pruned_turns: pruned,
      retained_turns: 0,
      estimated_tokens: baseline_tokens,
      folded_tools_count: 0,
      folded_chars_saved: 0,
    };
  }

  let remaining_history_budget = max_allowed_input_tokens.saturating_sub(baseline_tokens);

  let mut used_history_tokens = 0usize;
  let mut kept_messages_rev: Vec<OllamaMessage> = Vec::new();
  let mut pruned_count = 0usize;

  // Walk backwards from newest turn to oldest turn
  for msg in prior_messages.into_iter().rev() {
    let msg_tokens = estimate_message_tokens(&msg);

    if used_history_tokens + msg_tokens <= remaining_history_budget {
      used_history_tokens += msg_tokens;
      kept_messages_rev.push(msg);
    } else {
      pruned_count += 1;
    }
  }

  // Restore chronological order for kept messages
  kept_messages_rev.reverse();

  let retained_count = kept_messages_rev.len();
  let total_estimated = baseline_tokens + used_history_tokens;

  let mut final_messages = Vec::with_capacity(2 + retained_count);
  final_messages.push(system_message);
  final_messages.extend(kept_messages_rev);
  final_messages.push(active_user_prompt);

  if pruned_count > 0 {
    println!(
      "[llm2][sliding_window] ✂️ Slid context window: pruned {} older messages, retained {} messages (total estimated {}/{} tokens, budget {} tokens)",
      pruned_count, retained_count, total_estimated, num_ctx, max_allowed_input_tokens
    );
  }

  SlidingWindowResult {
    messages: final_messages,
    pruned_turns: pruned_count,
    retained_turns: retained_count,
    estimated_tokens: total_estimated,
    folded_tools_count: 0,
    folded_chars_saved: 0,
  }
}
