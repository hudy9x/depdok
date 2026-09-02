pub mod layer_explicit;
pub mod layer_categories;
pub mod layer_filter;
pub mod toolsets;

use std::time::Instant;
use serde::{Deserialize, Serialize};

#[allow(unused_imports)]
pub use layer_explicit::extract_explicit_tools;
#[allow(unused_imports)]
pub use layer_categories::classify_categories;
#[allow(unused_imports)]
pub use layer_filter::filter_redundant_tools;
pub use toolsets::Toolset;

pub const DEFAULT_TRIAGE_MODEL: &str = "qwen3.5:4b";

// Default configuration flags (can be overridden per request)
pub const ENABLE_LAYER_1_EXPLICIT: bool = true;
pub const ENABLE_LAYER_2_CATEGORIES: bool = true;
pub const ENABLE_LAYER_3_FILTER: bool = true;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassificationResult {
  pub label: String,
  pub toolsets: Vec<Toolset>,
  pub tools: Vec<String>,
  pub raw_output: String,
  pub latency_ms: u64,
  pub estimated_tokens: usize,
}

/// Computes the estimated token size of the selected tools when injected into Ollama schema.
/// Ollama injects tool instructions (~180 tokens) plus ~1 token per ~3.5 JSON characters of tool schema.
pub fn estimate_tools_token_count(tool_names: &[String]) -> usize {
  if tool_names.is_empty() {
    return 0;
  }
  let full_schema = crate::llm2::tools::get_builtin_tools_schema("gemma2:9b");
  let filtered = crate::llm2::tools::filter_tools_schema(full_schema, Some(&tool_names.to_vec()));
  let json_str = filtered.to_string();
  
  // Base system instructions overhead added by Ollama for function calling + schema tokens
  let schema_tokens = (json_str.len() as f64 / 3.5).ceil() as usize;
  180 + schema_tokens
}

/// Main entry point for tool routing.
/// Runs through the 3 layers:
/// - Layer 1: Explicit Override (/tool:<name>)
/// - Layer 2: Coarse Category Triage (FILE, FOLDER, WEB, etc.)
/// - Layer 3: Fine-grained Tool Filtering (pruning redundant candidate tools)
pub async fn resolve_tools_for_prompt(
  client: &reqwest::Client,
  model: &str,
  prompt: &str,
  enable_categories: Option<bool>,
  enable_filter: Option<bool>,
) -> Result<ClassificationResult, String> {
  let start_time = Instant::now();
  let trimmed_prompt = prompt.trim();

  let use_categories = enable_categories.unwrap_or(ENABLE_LAYER_2_CATEGORIES);
  let use_filter = enable_filter.unwrap_or(ENABLE_LAYER_3_FILTER);

  if trimmed_prompt.is_empty() {
    return Ok(ClassificationResult {
      label: "NONE".to_string(),
      toolsets: vec![Toolset::None],
      tools: vec![],
      raw_output: "EMPTY".to_string(),
      latency_ms: 0,
      estimated_tokens: 0,
    });
  }

  // --- LAYER 2: COARSE CATEGORY CLASSIFICATION ---
  let (toolsets, raw_output) = if use_categories {
    layer_categories::classify_categories(client, model, trimmed_prompt).await?
  } else {
    (vec![Toolset::All], "ALL".to_string())
  };

  // Collect candidate tools from matched categories
  let mut candidate_tools: Vec<String> = Vec::new();
  for ts in &toolsets {
    for tool_name in ts.tools() {
      let t_str = tool_name.to_string();
      if !candidate_tools.contains(&t_str) {
        candidate_tools.push(t_str);
      }
    }
  }

  // --- LAYER 3: FINE-GRAINED TOOL FILTERING ---
  let mut tools = if use_filter && candidate_tools.len() > 3 {
    layer_filter::filter_redundant_tools(client, model, trimmed_prompt, &candidate_tools).await
  } else {
    candidate_tools
  };

  // --- LAYER 1: EXPLICIT OVERRIDE ---
  if ENABLE_LAYER_1_EXPLICIT {
    let explicit_tools = layer_explicit::extract_explicit_tools(trimmed_prompt);
    for exp in explicit_tools {
      if !tools.contains(&exp) {
        tools.push(exp);
      }
    }
  }

  let label = if toolsets.is_empty() {
    "NONE".to_string()
  } else {
    toolsets
      .iter()
      .map(|ts| ts.as_str())
      .collect::<Vec<&str>>()
      .join(" + ")
  };

  let latency_ms = start_time.elapsed().as_millis() as u64;
  let estimated_tokens = estimate_tools_token_count(&tools);

  println!(
    "[llm2][router] Prompt: {:?} -> Labels: {} ({} tools, ~{} tokens) in {}ms [categories: {}, filter: {}]",
    trimmed_prompt,
    label,
    tools.len(),
    estimated_tokens,
    latency_ms,
    use_categories,
    use_filter
  );

  Ok(ClassificationResult {
    label,
    toolsets,
    tools,
    raw_output,
    latency_ms,
    estimated_tokens,
  })
}

/// Convenience alias for backward compatibility with live debug classifier command.
pub async fn fast_triage(
  client: &reqwest::Client,
  model: &str,
  prompt: &str,
  enable_categories: Option<bool>,
  enable_filter: Option<bool>,
) -> Result<ClassificationResult, String> {
  resolve_tools_for_prompt(client, model, prompt, enable_categories, enable_filter).await
}

/// Helper function called by `agent.rs`:
/// Integrates builtin tools, external MCP tools, explicit user overrides,
/// and applies the 3-layer router filtering into a final filtered JSON schema.
pub async fn resolve_effective_tools_schema(
  _client: &reqwest::Client,
  _tool_model: &str,
  content_model: &str,
  prompt: &str,
  allowed_tools: Option<Vec<String>>,
  mcp_manager: Option<&crate::mcp_client::McpClientManager>,
) -> serde_json::Value {
  use crate::llm2::tools::{filter_tools_schema, get_builtin_tools_schema};

  let mut all_tools_vec = get_builtin_tools_schema(content_model)
    .as_array()
    .cloned()
    .unwrap_or_default();

  if let Some(mgr) = mcp_manager {
    let mcp_tools = mgr.get_ollama_tools().await;
    if !mcp_tools.is_empty() {
      println!(
        "[llm2][agent] Injected {} external MCP tools into Ollama schema.",
        mcp_tools.len()
      );
      all_tools_vec.extend(mcp_tools);
    }
  }

  // Layer 1: Extract explicit user tool overrides (e.g. "tool:create_file" or "/tool:create_file")
  let mut final_allowed_tools = allowed_tools;
  if ENABLE_LAYER_1_EXPLICIT {
    let explicit_tools = layer_explicit::extract_explicit_tools(prompt);
    if !explicit_tools.is_empty() {
      println!(
        "[llm2][router] Explicit user tool override detected: {:?}",
        explicit_tools
      );
      if let Some(ref mut allowed) = final_allowed_tools {
        for exp in explicit_tools {
          if !allowed.contains(&exp) {
            allowed.push(exp);
          }
        }
      } else {
        final_allowed_tools = Some(explicit_tools);
      }
    }
  }

  filter_tools_schema(serde_json::json!(all_tools_vec), final_allowed_tools.as_ref())
}
