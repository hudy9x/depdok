use super::system_prompt::build_system_prompt;
use super::types::OllamaMessage;
use crate::mcp_client::McpClientManager;

/// Default character limit for tool execution payloads in history.
pub const MAX_TOOL_PAYLOAD_CHARS: usize = 3000;

/// Strips `<think>...</think>` internal reasoning tags from assistant message content
/// so previous turns do not bloat the context window during multi-turn conversations.
pub fn strip_thinking_tags(text: &str) -> String {
  let mut result = String::with_capacity(text.len());
  let mut remaining = text;
  while let Some(start) = remaining.find("<think>") {
    result.push_str(&remaining[..start]);
    if let Some(end) = remaining[start..].find("</think>") {
      remaining = &remaining[start + end + 8..];
    } else {
      // Unclosed think tag: omit remainder
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

/// Prepares the complete, sanitized conversation history vector for the Ollama chat turn.
pub async fn prepare_agent_history(
  model_to_use: &str,
  content_model_to_use: &str,
  prompt: &str,
  initial_history: Option<Vec<OllamaMessage>>,
  system_prompt_addendum: Option<String>,
  mcp_manager: Option<&McpClientManager>,
) -> Vec<OllamaMessage> {
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

  let mut history: Vec<OllamaMessage> = vec![
    OllamaMessage {
      role: "system".to_string(),
      content: system_content,
      tool_calls: None,
    },
  ];

  // Append cleaned prior messages
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

      history.push(msg);
    }
  }

  // Append active user prompt
  history.push(OllamaMessage {
    role: "user".to_string(),
    content: prompt.to_string(),
    tool_calls: None,
  });

  history
}
