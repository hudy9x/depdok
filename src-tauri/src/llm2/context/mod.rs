pub mod compact;
pub mod sliding_window;
pub mod system_prompt;

#[allow(unused_imports)]
pub use compact::{compact_full_history, compact_tool_payloads, CompactedResult};
#[allow(unused_imports)]
pub use sliding_window::{apply_sliding_window, estimate_message_tokens, estimate_tokens, SlidingWindowResult};
pub use system_prompt::build_system_prompt;

use crate::llm2::types::OllamaMessage;
use crate::mcp_client::McpClientManager;

/// Default maximum characters allowed in a historical tool result payload before truncation.
pub const MAX_TOOL_PAYLOAD_CHARS: usize = 3000;

/// Strips reasoning/planning `<think>...</think>` tags from a message string.
pub fn strip_thinking_tags(text: &str) -> String {
  let mut result = String::new();
  let mut remaining = text;

  while let Some(start) = remaining.find("<think>") {
    result.push_str(&remaining[..start]);
    if let Some(end) = remaining[start..].find("</think>") {
      remaining = &remaining[start + end + 8..];
    } else {
      // Unclosed think tag: discard the rest
      remaining = "";
      break;
    }
  }

  result.push_str(remaining);
  result.trim().to_string()
}

/// Truncates a tool result payload if it exceeds `max_chars`, appending a polite note.
pub fn truncate_tool_payload(content: &str, max_chars: usize) -> String {
  if content.len() <= max_chars {
    return content.to_string();
  }

  let truncated = &content[..max_chars];
  format!(
    "{}\n\n... [Output truncated. Total length: {} chars, showing first {}. Request specific sections, ranges, or filters for more details.]",
    truncated,
    content.len(),
    max_chars
  )
}

/// Prepares the complete, sanitized conversation history vector for the Ollama chat turn,
/// applying tool folding and sliding window budgeting dynamically based on `num_ctx`.
pub async fn prepare_agent_history(
  model_to_use: &str,
  content_model_to_use: &str,
  prompt: &str,
  initial_history: Option<Vec<OllamaMessage>>,
  system_prompt_addendum: Option<String>,
  mcp_manager: Option<&McpClientManager>,
  num_ctx: usize,
  tools_schema: Option<&serde_json::Value>,
  auto_compact: bool,
  sliding_window_enabled: bool,
) -> (Vec<OllamaMessage>, SlidingWindowResult) {
  let mut system_content = build_system_prompt(model_to_use, content_model_to_use);

  // Inject active MCP servers & discovered tools info
  if let Some(mgr) = mcp_manager {
    let summaries = mgr.list_servers().await;
    let connected: Vec<_> = summaries
      .into_iter()
      .filter(|s| s.status == "connected" && s.tools_count > 0)
      .collect();
    if !connected.is_empty() {
      system_content.push_str("\n\n---\n## Connected MCP (Model Context Protocol) Servers & External Tools\n");
      system_content.push_str("The following external MCP servers are currently connected and active. You have full capability and permission to invoke their tools:\n");
      for s in connected {
        system_content.push_str(&format!(
          "- Server '{}' ({} tools): {}\n",
          s.name,
          s.tools_count,
          s.tools.join(", ")
        ));
      }
      system_content.push_str("When the user asks to query, perform actions on, or interact with any of these services, you MUST invoke the corresponding MCP tool function instead of stating that you cannot access them.\n");
    }
  }

  // Inject active Skill instructions addendum
  if let Some(addendum) = system_prompt_addendum {
    if !addendum.trim().is_empty() {
      system_content.push_str("\n\n---\n## Active Skill Instructions\n");
      system_content.push_str(addendum.trim());
    }
  }

  let system_message = OllamaMessage {
    role: "system".to_string(),
    content: system_content,
    tool_calls: None,
  };

  // Clean prior messages (strip thoughts & truncate tool payloads)
  let mut cleaned_prior_messages: Vec<OllamaMessage> = Vec::new();
  if let Some(prev_messages) = initial_history {
    for mut msg in prev_messages {
      if msg.role == "system" {
        continue;
      }

      // Strip <think> tags from historical assistant messages
      if msg.role == "assistant" {
        msg.content = strip_thinking_tags(&msg.content);
      }

      // Truncate overly verbose historical tool results
      if msg.role == "tool" {
        msg.content = truncate_tool_payload(&msg.content, MAX_TOOL_PAYLOAD_CHARS);
      }

      cleaned_prior_messages.push(msg);
    }
  }

  // If auto-compact is enabled, fold historical tool outputs to save context
  let (folded_count, chars_saved) = if auto_compact {
    compact_tool_payloads(&mut cleaned_prior_messages)
  } else {
    (0, 0)
  };

  let active_user_prompt = OllamaMessage {
    role: "user".to_string(),
    content: prompt.to_string(),
    tool_calls: None,
  };

  if sliding_window_enabled {
    let mut sliding_res = apply_sliding_window(
      system_message,
      cleaned_prior_messages,
      active_user_prompt,
      num_ctx,
      tools_schema,
    );
    sliding_res.folded_tools_count = folded_count;
    sliding_res.folded_chars_saved = chars_saved;
    (sliding_res.messages.clone(), sliding_res)
  } else {
    let retained_count = cleaned_prior_messages.len();
    let mut all_msgs = Vec::with_capacity(2 + retained_count);
    all_msgs.push(system_message.clone());
    all_msgs.extend(cleaned_prior_messages);
    all_msgs.push(active_user_prompt.clone());

    let est_tokens: usize = all_msgs.iter().map(estimate_message_tokens).sum();

    let sliding_res = SlidingWindowResult {
      messages: all_msgs.clone(),
      pruned_turns: 0,
      retained_turns: retained_count,
      estimated_tokens: est_tokens,
      folded_tools_count: folded_count,
      folded_chars_saved: chars_saved,
    };
    (all_msgs, sliding_res)
  }
}
