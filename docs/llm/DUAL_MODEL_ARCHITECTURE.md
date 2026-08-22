# Dual-Model Specialization & Per-Tool Timeout Architecture

This document describes the **Dual-Model Specialization Architecture**, **Direct Backend Delegation**, and **Per-Tool Timeout Safeguard System** implemented in Tauri 2, `rig-core`, Tokio, and Ollama.

---

## 1. The Dual-Model Specialization Pattern

Instead of relying on a single LLM to handle both fast deterministic tool calling and creative long-form prose, the application pairs two complementary models:

```
                                  ┌────────────────────────────────┐
                                  │      React User Interface      │
                                  │   (LLMChat2Panel & Tool Cards) │
                                  └───────────────┬────────────────┘
                                                  │
                                 Tauri IPC ("llm2_send_message")
                                                  │
                                                  ▼
                                  ┌────────────────────────────────┐
                                  │      Rust Agent Controller     │
                                  │  (src-tauri/src/llm2/agent.rs) │
                                  └───────────────┬────────────────┘
                                                  │
                  ┌───────────────────────────────┴───────────────────────────────┐
                  │                                                               │
                  ▼                                                               ▼
    ⚙️ Tool Specialist: qwen2.5:7b                                 ✍️ Content Specialist: gemma2:9b
 ─────────────────────────────────────                           ─────────────────────────────────────
 • Fast intent classification                                    • Deep creative Markdown writing
 • JSON argument extraction & tool routing                       • Long-form articles & multi-section guides
 • Multi-tool calling orchestration                              • Editorial critique & review
 • Workspace file system operations                              • Natural tone & nuances
 • Markdown reading, upserting & comments                        • Direct Rust backend invocation (0 IPC hops)
```

---

## 2. The `generate_content` Tool Workflow

When an in-depth article, report, or tutorial is requested, `qwen2.5:7b` recognizes the intent, gathers context (e.g. via `read_markdown` or database queries), and invokes the **`generate_content`** tool, delegating the writing task directly to `gemma2:9b`.

```
User: "Read @notes.md and write a comprehensive tutorial on Rust Tokio async tasks."
  │
  ▼
[Turn 0: qwen2.5:7b (Tool Model)]
  └── ToolCall: read_markdown({ path: "notes.md" })  ──> React returns document text & headings outline
  │
  ▼
[Turn 1: qwen2.5:7b (Tool Model)]
  └── ToolCall: generate_content({
        topic: "Comprehensive tutorial on Rust Tokio async tasks with code examples and best practices based on notes.md",
        style: "professional tutorial with code blocks",
        language: "English"
      })
      │
      ▼ (Executed directly in Rust backend via reqwest to Ollama)
[gemma2:9b (Content Model)]
  └── Generates rich, polished 3KB Markdown prose with headers, syntax highlighting, and explanations.
  │
  ▼
[Turn 2: qwen2.5:7b (Tool Model)]
  ├── Optional ToolCall: upsert_markdown_section({ heading: "Tokio Async Tutorial", replacement_content: ... })
  └── Streams final synthesized answer & tool execution cards to the UI.
```

---

## 3. Direct Backend Execution vs. Frontend Bridge

Tools in Depdok are categorized by where their execution logic lives:

| Tool Type | Execution Location | Examples | Why? |
|---|---|---|---|
| **UI & Workspace Tools** | **Frontend (React)** | `read_markdown`, `upsert_markdown`, `upsert_markdown_section`, `add_markdown_comment`, `create_file`, `rename_file`, `delete_file_or_folder` | Direct access to Jotai atoms (`activeTab`, `workspaceRoot`), UI toasts, editor DOM, and immediate file tree refreshing. |
| **Model-to-Model Tools** | **Backend (Rust)** | `generate_content` | Direct HTTP POST to Ollama via `reqwest` in Rust. **Zero IPC roundtrip latency**, no large string serialization over Tauri channels, and managed directly by Tokio async runtime. |

### Direct Rust Execution in `GenerateContentTool` (`src-tauri/src/llm2/tools/content.rs`):
```rust

impl PortableTool for GenerateContentTool {
    const NAME: &'static str = "generate_content";
    type Error = ToolBridgeError;
    type Args = GenerateContentArgs;
    type Output = serde_json::Value;

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        let content_model = args.content_model.as_deref().unwrap_or("gemma2:9b");
        let style = args.style.as_deref().unwrap_or("informative and engaging markdown");
        let language = args.language.as_deref().unwrap_or("English");

        // 1. Emit live start event to Frontend Tool Monitor
        let _ = self.app.emit("tool_log_event", json!({
            "id": Uuid::new_v4().to_string(),
            "requestId": Uuid::new_v4().to_string(),
            "toolName": Self::NAME,
            "args": { "topic": args.topic, "style": style, "language": language },
            "status": "executing",
            "timestamp": chrono::Utc::now().to_rfc3339()
        }));

        // 2. Direct HTTP call to Ollama targeting gemma2:9b
        let client = reqwest::Client::new();
        let res = client.post("http://localhost:11434/api/chat")
            .json(&json!({
                "model": content_model,
                "messages": [
                    { "role": "system", "content": system_prompt },
                    { "role": "user", "content": user_prompt }
                ],
                "stream": false,
            }))
            .send()
            .await?;

        // 3. Emit success event & return prose
        let body: serde_json::Value = res.json().await?;
        let text = body.get("message").and_then(|m| m.get("content")).and_then(|c| c.as_str()).unwrap_or_default();

        Ok(json!({ "modelUsed": content_model, "content": text }))
    }
}
```

---

## 4. Per-Tool Timeout Safeguard System

### Problem
Fast deterministic tools (`read_markdown`, `sum_four_digits`, `create_file`) finish in **5–50ms**. However, generating a multi-page Markdown tutorial using `gemma2:9b` on a local CPU/GPU machine can take **20–60 seconds**. A short global timeout would abort generation prematurely.

### Solution: Decoupled Adaptive Timeouts
- **Standard Tools**: **60 seconds** (`call_frontend_tool_with_timeout`).
- **Content Generation Tools**: **180 seconds (3 minutes)** (`tokio::time::timeout`).

```rust
// Standard frontend tools: 60s
pub async fn call_frontend_tool<Args: Serialize>(
    app: &AppHandle,
    pending: &PendingRequests,
    tool_name: &str,
    args: Args,
) -> Result<serde_json::Value, ToolBridgeError> {
    call_frontend_tool_with_timeout(app, pending, tool_name, args, Duration::from_secs(60)).await
}

// Timeout helper with explicit cancellation cleanup
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

    let payload = ToolRequestPayload { request_id: request_id.clone(), tool_name: tool_name.to_string(), args: serde_json::to_value(args)? };
    app.emit("tool_request", &payload)?;

    match tokio::time::timeout(timeout_duration, rx).await {
        Ok(Ok(Ok(val))) => Ok(val),
        Ok(Ok(Err(err_msg))) => Err(ToolBridgeError(err_msg)),
        Ok(Err(_)) => Err(ToolBridgeError("Channel closed unexpectedly".to_string())),
        Err(_) => {
            pending.remove(&request_id);
            Err(ToolBridgeError(format!("Tool execution timed out after {}s", timeout_duration.as_secs())))
        }
    }
}
```

---

## 5. Backend Structured Debug Logging

The backend outputs clear formatted debug blocks for every Ollama turn and secondary model call in the terminal:

```text
════════════════════ [llm2][turn 0] REQUEST TO OLLAMA ════════════════════
Model: qwen2.5:7b
Payload: { "messages": [ ... ], "tools": [ ... ], "stream": true }
────────────────────────────────────────────────────────────────────────────

════════════════════ [llm2][turn 0] RESPONSE FROM OLLAMA ════════════════════
Text delta (len 0): <empty>
Tool Calls (count 1): [ { "function": { "name": "generate_content", "arguments": { ... } } } ]
────────────────────────────────────────────────────────────────────────────

════════════════════ [llm2][content_model] REQUEST TO OLLAMA ════════════════════
Model: gemma2:9b
Payload: { "messages": [ ... ], "stream": false }
────────────────────────────────────────────────────────────────────────────

════════════════════ [llm2][content_model] RESPONSE FROM OLLAMA ════════════════════
Generated prose (len 2410):
# Complete Guide to Rust Tokio Tasks ...
────────────────────────────────────────────────────────────────────────────
```

---

## 6. Summary of Best Practices

1. **Role Division**: Use `qwen2.5:7b` for fast multi-tool intent classification and orchestration; delegate creative writing to `gemma2:9b`.
2. **Execution Colocation**: Keep tools that manipulate React state on the frontend; execute pure LLM-to-LLM secondary tools on the Rust backend.
3. **Adaptive Timeouts**: Assign 180s timeout safeguards for secondary model calls.
4. **Transparent UI Monitoring**: Emit `tool_log_event` so users see live cards inside chat messages while tools execute.
