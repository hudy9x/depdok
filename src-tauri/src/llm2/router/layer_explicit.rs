use super::toolsets::ALL_KNOWN_TOOLS;

/// Layer 1: Deterministic Explicit Override.
/// Inspects user prompt for explicit tool tokens (e.g., `tool:<name>`, `/tool:<name>`).
/// Always 100% accurate and instant (0ms latency).
pub fn extract_explicit_tools(prompt: &str) -> Vec<String> {
  let mut explicit_tools = Vec::new();
  for word in prompt.split_whitespace() {
    let clean = word
      .trim_matches(|c: char| c == ',' || c == ';' || c == ')' || c == '(' || c == '`' || c == '"' || c == '\'');
    
    let potential_tool = if let Some(stripped) = clean.strip_prefix("/tool:") {
      Some(stripped)
    } else if let Some(stripped) = clean.strip_prefix("tool:") {
      Some(stripped)
    } else if let Some(stripped) = clean.strip_prefix("/tool-") {
      Some(stripped)
    } else {
      None
    };

    if let Some(tool_candidate) = potential_tool {
      let lower = tool_candidate.to_lowercase();
      for known in ALL_KNOWN_TOOLS {
        if known.to_lowercase() == lower && !explicit_tools.contains(&known.to_string()) {
          explicit_tools.push(known.to_string());
        }
      }
    }
  }
  explicit_tools
}
