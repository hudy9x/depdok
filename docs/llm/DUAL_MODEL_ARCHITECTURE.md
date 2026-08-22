# Dual-Model Specialization & Per-Tool Timeout Architecture

This document describes the **Dual-Model Specialization Architecture** and **Per-Tool Timeout Safeguard System** implemented in Tauri 2, `rig-core`, and Ollama.

---

## 1. The Dual-Model Specialization Pattern

Instead of relying on a single LLM to handle both fast deterministic tool calling and creative long-form prose, the application pairs two complementary models:

```
                                  ┌────────────────────────────────┐
                                  │      React User Interface      │
                                  └───────────────┬────────────────┘
                                                  │
                                 Tauri IPC ("send_message")
                                                  │
                                                  ▼
                                  ┌────────────────────────────────┐
                                  │      Rust Agent Controller     │
                                  │           (rig-core)           │
                                  └───────────────┬────────────────┘
                                                  │
                  ┌───────────────────────────────┴───────────────────────────────┐
                  │                                                               │
                  ▼                                                               ▼
    ⚙️ Tool Specialist: qwen2.5:7b                                 ✍️ Content Specialist: gemma2:9b
 ─────────────────────────────────────                           ─────────────────────────────────────
 • Fast intent classification                                    • Deep creative Markdown writing
 • JSON argument extraction                                      • Long-form articles & tutorials
 • Multi-tool calling orchestration                              • Editorial critique & review
 • PlantUML / Mermaid / Excel logic                              • Natural tone & nuances
 • Vietnamese & Japanese translations
```

---

## 2. The `generate_content` Tool Workflow

When an in-depth article, report, or biography is requested, `qwen2.5:7b` gathers the required information (via database lookups or calculations) and invokes the **`generate_content`** tool, delegating the writing task to `gemma2:9b`.

```
User: "Look up Alice Smith and write an engaging professional Markdown biography for her."
  │
  ▼
[Turn 0: qwen2.5:7b (Tool Model)]
  ├── ToolCall 1: get_user_age("Alice Smith")      ──> React returns: 28
  ├── ToolCall 2: get_user_country("Alice Smith")  ──> React returns: "United States"
  └── ToolCall 3: get_user_dob("Alice Smith")      ──> React returns: "1998-04-12"
  │
  ▼
[Turn 1: qwen2.5:7b (Tool Model)]
  └── ToolCall: generate_content({
        topic: "Alice Smith, 28 years old, from United States, born 1998-04-12",
        style: "professional biography",
        language: "English"
      })
      │
      ▼ (Delegated to Content Model)
[gemma2:9b (Content Model)]
  └── Writes a rich, polished 3KB Markdown biography with headers, quotes, and styling.
  │
  ▼
[Turn 2: qwen2.5:7b (Tool Model)]
  └── Final Synthesized Answer presented in the chat timeline.
```

---

## 3. Per-Tool Timeout Safeguard System

### Problem
Instant tools like `sum_four_digits` or `get_user_age` finish in under **5ms**. However, when generating a multi-page Markdown tutorial using `gemma2:9b` on a **CPU-only 16GB RAM PC**, generation takes **20–30 seconds**. A global 15-second timeout caused `generate_content` to fail prematurely.

### Solution: `call_frontend_tool_with_timeout`
We decoupled timeouts so each tool has an appropriate safeguard duration:
- **Standard Tools** (`sum_four_digits`, `get_user_age`, `get_week_of_month`): **60 seconds**.
- **LLM Content Generation Tools** (`generate_content`): **180 seconds (3 minutes)**.

```rust
// src-tauri/src/llm/tools.rs
pub async fn call_frontend_tool<Args: Serialize>(
    app: &AppHandle,
    pending: &PendingRequests,
    tool_name: &str,
    args: Args,
) -> Result<serde_json::Value, ToolBridgeError> {
    // Default 60s timeout for regular tools
    call_frontend_tool_with_timeout(app, pending, tool_name, args, Duration::from_secs(60)).await
}

pub async fn call_frontend_tool_with_timeout<Args: Serialize>(
    app: &AppHandle,
    pending: &PendingRequests,
    tool_name: &str,
    args: Args,
    timeout_duration: Duration,
) -> Result<serde_json::Value, ToolBridgeError> {
    let request_id = Uuid::new_v4().to_string();
    let (tx, rx) = tokio::sync::oneshot::channel();

    pending.insert(request_id.clone(), tx);

    let args_val = serde_json::to_value(args)
        .map_err(|e| ToolBridgeError(format!("Failed to serialize tool args: {}", e)))?;

    let payload = ToolRequestPayload {
        request_id: request_id.clone(),
        tool_name: tool_name.to_string(),
        args: args_val,
    };

    if let Err(e) = app.emit("tool_request", &payload) {
        pending.remove(&request_id);
        return Err(ToolBridgeError(format!("Failed to emit event to frontend: {}", e)));
    }

    match tokio::time::timeout(timeout_duration, rx).await {
        Ok(Ok(Ok(val))) => Ok(val),
        Ok(Ok(Err(err_msg))) => Err(ToolBridgeError(format!("Frontend error: {}", err_msg))),
        Ok(Err(_)) => Err(ToolBridgeError("Channel closed unexpectedly".to_string())),
        Err(_) => {
            pending.remove(&request_id);
            Err(ToolBridgeError(format!(
                "Tool execution timed out after {} seconds",
                timeout_duration.as_secs()
            )))
        }
    }
}

// GenerateContentTool uses 180s timeout
impl PortableTool for GenerateContentTool {
    const NAME: &'static str = "generate_content";
    // ...
    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        call_frontend_tool_with_timeout(
            &self.app,
            &self.pending,
            Self::NAME,
            args,
            Duration::from_secs(180), // 3 minutes timeout for CPU LLM generation
        )
        .await
    }
}
```

---

## 4. Code Implementation Summary

### A. Frontend Tool (`src/tools/generateContent.ts`)
```typescript
import { invoke } from "@tauri-apps/api/core";

export interface GenerateContentArgs {
  topic: string;
  style?: string;
  language?: string;
  contentModel?: string;
}

export async function generateContent(
  args: GenerateContentArgs,
  activeContentModel: string = "gemma2:9b"
) {
  const modelToUse = args.contentModel || activeContentModel;
  const style = args.style || "informative and engaging markdown";
  const language = args.language || "English";

  const systemPrompt = `You are an expert content creator, technical writer, and editor specializing in high-quality Markdown content.
Target Style: ${style}
Target Language: ${language}
Provide rich, well-formatted, beautiful Markdown with appropriate headers, bullet points, and clear explanations.`;

  const userPrompt = `Topic / Request:\n${args.topic}\n\nPlease generate complete, high-quality content now.`;

  const generatedMarkdown = await invoke<string>("generate_content", {
    prompt: userPrompt,
    model: modelToUse,
    systemPrompt: systemPrompt,
  });

  return {
    topic: args.topic,
    style,
    language,
    modelUsed: modelToUse,
    content: generatedMarkdown,
  };
}
```

### B. Rust Direct Content Generation (`src-tauri/src/llm/agent.rs`)
```rust
pub async fn generate_content_direct(
    prompt: &str,
    model_name: Option<&str>,
    system_prompt: Option<&str>,
) -> Result<String, String> {
    let client = ollama::Client::new(Nothing).map_err(|e| format!("Ollama client error: {}", e))?;
    let active_model = model_name.unwrap_or("gemma2:9b");

    let model = client.completion_model(active_model);
    let preamble = system_prompt.unwrap_or(
        "You are an expert creative writer, editor, and content specialist. Write rich, engaging, well-structured markdown content."
    );

    let request = model
        .completion_request(prompt)
        .preamble(preamble.to_string())
        .build();

    let response = model
        .completion(request)
        .await
        .map_err(|e| format!("Content generation error (model '{}'): {}", active_model, e))?;

    let output = response
        .choice
        .into_iter()
        .filter_map(|c| {
            if let AssistantContent::Text(t) = c {
                Some(t.text)
            } else {
                None
            }
        })
        .collect::<Vec<_>>()
        .join("\n");

    Ok(output)
}
```

---

## 5. Summary of Best Practices for Multi-Model Desktop Apps

1. **Role Division**: Use smaller, faster models (`qwen2.5:7b` / `qwen3.5:4b`) for UI orchestration & tool calling, and larger models (`gemma2:9b` / `llama3.1:8b`) for writing & reviewing.
2. **On-Demand Loading**: Ollama manages model swapping in RAM automatically, keeping total memory footprint under 6GB on a 16GB PC.
3. **Adaptive Timeouts**: Always use extended timeouts (180s+) for tool calls that perform secondary LLM generation.
