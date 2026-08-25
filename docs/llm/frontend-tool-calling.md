# Tauri + Rig + Ollama: Frontend Tool-Calling Architecture Reference

A comprehensive architecture and implementation reference for orchestrating LLM tool-calling in **Rust (`rig-core`)** while executing tool logic on the **Frontend (React / TypeScript)** via **Tauri 2 IPC** — including **single-tool** and **parallel multi-tool calling**.

---

## 1. High-Level Architecture & Flow

### Why this pattern?
Normally, LLM agents execute tools directly in backend Rust code. However, desktop and web-wrapper apps frequently need tools that interact with the **frontend environment** (DOM, browser storage, React state, canvas, client-side DBs, web APIs, UI dialogs, etc.).

This architecture bridges both worlds: **Rust acts as the LLM agent orchestrator**, while **React executes the tool functions**.

```
┌─────────────────┐       Tauri IPC ("send_message")        ┌────────────────────────┐
│                 │ ──────────────────────────────────────> │                        │
│                 │                                         │  Rust Orchestrator     │
│   React UI      │    Multi-Turn / Multi-Tool Loop         │  (Rig Agent Loop)      │
│   (Frontend)    │ <────────────────────────────────────── │                        │
│                 │        Tauri Event ("tool_request")     └───────────┬────────────┘
│                 │                                                     │
│                 │                                                     │ HTTP
│                 │       Tauri Command ("tool_result")                 ▼
│                 │ ──────────────────────────────────────> ┌────────────────────────┐
│                 │                                         │  Ollama                │
│                 │ <────────────────────────────────────── │  (qwen3.5:4b)          │
└─────────────────┘             Final Text Answer           └────────────────────────┘
```

---

## 2. Multi-Tool Calling at Once (Parallel Execution)

### How Multi-Tool Calling Works
When a user asks for multiple pieces of information in a single query (e.g. *"What is the age, country, and date of birth of Alice Smith?"*):
1. **Ollama returns multiple tool calls in a single response turn**: `response.choice` contains multiple `AssistantContent::ToolCall` items (`get_user_age`, `get_user_country`, `get_user_dob`).
2. **Rust dispatches each tool call to React**:
   - Each tool generates its own unique `request_id` and `oneshot` channel.
   - Emits separate `tool_request` events to the frontend.
3. **React executes the tool functions**:
   - React handles each event independently and returns outputs via `invoke("tool_result", { requestId, result })`.
4. **Rust aggregates all tool results**:
   - Appends the assistant message with all tool calls to `history`.
   - Appends all matching `UserContent::ToolResult` messages to `history`.
5. **Final Synthesis**: Rust sends the updated history back to Ollama in the next turn, allowing the model to produce a unified answer incorporating all tool outputs.

```
User Prompt: "Get age, country, and DOB for Alice Smith"
     │
     ▼
Ollama Response (Turn 0):
  ├── ToolCall: get_user_age("Alice Smith")      ──> React executes (28)
  ├── ToolCall: get_user_country("Alice Smith")  ──> React executes ("United States")
  └── ToolCall: get_user_dob("Alice Smith")      ──> React executes ("1998-04-12")
     │
     ▼
Ollama Response (Turn 1):
  └── Final Synthesized Answer: "Alice Smith is 28 years old, from the United States, born on April 12, 1998."
```

---

## 3. Project & File Structure

```
depdok-llm-rust/
├── src/                               # ⚛️ React (Frontend)
│   ├── App.tsx                        # Main Chat UI + Live Tool Execution Monitor
│   ├── App.css                        # Modern dark-mode styling & inspector layout
│   ├── main.tsx                       # React application root
│   ├── data/
│   │   └── users.ts                   # 50-record mock user database for multi-tool queries
│   ├── hooks/
│   │   └── useToolListener.ts         # Tauri IPC event listener + tool dispatcher
│   └── tools/                         # Client-side tool implementations
│       ├── sumFourDigits.ts           # Math calculation tool
│       ├── createRandomName.ts        # Random name generator tool
│       ├── getWeekOfMonth.ts          # Calendar calculation tool
│       ├── getUserName.ts             # User lookup tool
│       ├── getUserAge.ts              # User age tool
│       ├── getUserCountry.ts          # User country tool
│       └── getUserDob.ts              # User DOB tool
│
├── src-tauri/                         # 🦀 Rust (Backend)
│   ├── Cargo.toml                     # Rust dependencies (rig-core, tokio, uuid, tauri)
│   ├── tauri.conf.json                # Tauri app configuration
│   └── src/
│       ├── main.rs                    # Tauri executable binary entry point
│       ├── lib.rs                     # Library entry: registers `llm` module & commands
│       └── llm/                       # 📂 LLM & Tool-Calling Subsystem
│           ├── mod.rs                 # Exposes agent, tools, pending, and commands
│           ├── agent.rs               # Rig agent setup & Ollama multi-turn loop
│           ├── tools.rs               # PortableTool trait structs & IPC bridge
│           ├── pending.rs             # Oneshot channel registry for async requests
│           └── commands.rs            # Tauri #[tauri::command] handlers
│
└── docs/
    ├── plan.md                        # Original verification plan
    └── REFERENCE.md                   # Complete architectural guide & reference
```

### Module Responsibilities Breakdown

| Module / File | Responsibility |
|---|---|
| `src-tauri/src/llm/pending.rs` | Maintains a thread-safe `HashMap<request_id, oneshot::Sender>` to pause the async `send_message` handler until React returns `tool_result`. |
| `src-tauri/src/llm/tools.rs` | Implements `rig::tool::PortableTool` for each tool. Its `call()` emits a `tool_request` event over Tauri IPC and awaits the channel with a 15s timeout. |
| `src-tauri/src/llm/agent.rs` | Sets up Ollama client (`qwen3.5:4b`), seeds conversation history, and runs the multi-turn resolution loop for single or multiple tool calls. |
| `src-tauri/src/llm/commands.rs` | Exposes `send_message` and `tool_result` to Tauri IPC. |
| `src-tauri/src/lib.rs` | Mounts `PendingRequests` in Tauri state (`manage`) and registers the command handlers. |
| `src/hooks/useToolListener.ts` | Subscribes to `tool_request`, deduplicates IDs, dispatches to matching TS functions, and sends results back via `tool_result`. |
| `src/data/users.ts` | Provides 50 mock user records for verifying multi-attribute tool calling (`age`, `country`, `dob`). |

---

## 4. Dependencies

### Rust (`src-tauri/Cargo.toml`)
```toml
[dependencies]
# Tauri Core
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"

# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# LLM Framework (Ollama provider, PortableTool trait, Completion loop)
rig = { package = "rig-core", version = "0.42" }

# Async Primitives & Request ID
tokio = { version = "1", features = ["sync", "time", "macros", "rt"] }
uuid = { version = "1", features = ["v4", "serde"] }
```

### Frontend (`package.json`)
```json
{
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-opener": "^2"
  },
  "devDependencies": {
    "typescript": "~5.8.3",
    "vite": "^7.0.4",
    "@tauri-apps/cli": "^2"
  }
}
```

---

## 5. Backend Rust Implementation

### A. The Channel Bridge (`src-tauri/src/llm/pending.rs`)
Thread-safe registry mapping `request_id` to `tokio::sync::oneshot::Sender`.

```rust
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;

pub type ToolResultResponse = Result<serde_json::Value, String>;

#[derive(Clone, Default)]
pub struct PendingRequests {
    map: Arc<Mutex<HashMap<String, oneshot::Sender<ToolResultResponse>>>>,
}

impl PendingRequests {
    pub fn new() -> Self {
        Self {
            map: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn insert(&self, request_id: String, sender: oneshot::Sender<ToolResultResponse>) {
        let mut map = self.map.lock().unwrap();
        map.insert(request_id, sender);
    }

    pub fn resolve(&self, request_id: &str, result: ToolResultResponse) -> bool {
        let mut map = self.map.lock().unwrap();
        if let Some(sender) = map.remove(request_id) {
            let _ = sender.send(result);
            true
        } else {
            false
        }
    }

    pub fn remove(&self, request_id: &str) {
        let mut map = self.map.lock().unwrap();
        map.remove(request_id);
    }
}
```

---

### B. Portable Tools & IPC Bridge (`src-tauri/src/llm/tools.rs`)
Defines `PortableTool` implementations and the IPC event bridge with timeout safety.

```rust
use rig::tool::PortableTool;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fmt::Display;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use super::pending::PendingRequests;

#[derive(Debug)]
pub struct ToolBridgeError(pub String);

impl Display for ToolBridgeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for ToolBridgeError {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolRequestPayload {
    pub request_id: String,
    pub tool_name: String,
    pub args: serde_json::Value,
}

pub async fn call_frontend_tool<Args: Serialize>(
    app: &AppHandle,
    pending: &PendingRequests,
    tool_name: &str,
    args: Args,
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

    // Emit event to React frontend
    if let Err(e) = app.emit("tool_request", &payload) {
        pending.remove(&request_id);
        return Err(ToolBridgeError(format!("Failed to emit event to frontend: {}", e)));
    }

    // Await response from React with a 15-second timeout safeguard
    match tokio::time::timeout(Duration::from_secs(15), rx).await {
        Ok(Ok(Ok(val))) => Ok(val),
        Ok(Ok(Err(err_msg))) => Err(ToolBridgeError(format!("Frontend error: {}", err_msg))),
        Ok(Err(_)) => Err(ToolBridgeError("Channel closed unexpectedly".to_string())),
        Err(_) => {
            pending.remove(&request_id);
            Err(ToolBridgeError("Tool execution timed out after 15 seconds".to_string()))
        }
    }
}

// Example User Attribute Tools
#[derive(Clone)]
pub struct GetUserAgeTool {
    pub app: AppHandle,
    pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct GetUserAgeArgs {
    pub name: String,
}

impl PortableTool for GetUserAgeTool {
    const NAME: &'static str = "get_user_age";
    type Error = ToolBridgeError;
    type Args = GetUserAgeArgs;
    type Output = serde_json::Value;

    fn description(&self) -> String {
        "Get the age of a specific user by their name from the user database.".to_string()
    }

    fn parameters(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "name": { "type": "string", "description": "The full name of the user" }
            },
            "required": ["name"]
        })
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
    }
}

#[derive(Clone)]
pub struct GetUserCountryTool {
    pub app: AppHandle,
    pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct GetUserCountryArgs {
    pub name: String,
}

impl PortableTool for GetUserCountryTool {
    const NAME: &'static str = "get_user_country";
    type Error = ToolBridgeError;
    type Args = GetUserCountryArgs;
    type Output = serde_json::Value;

    fn description(&self) -> String {
        "Get the country of residence / nationality of a specific user by their name.".to_string()
    }

    fn parameters(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "name": { "type": "string", "description": "The full name of the user" }
            },
            "required": ["name"]
        })
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
    }
}

#[derive(Clone)]
pub struct GetUserDobTool {
    pub app: AppHandle,
    pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct GetUserDobArgs {
    pub name: String,
}

impl PortableTool for GetUserDobTool {
    const NAME: &'static str = "get_user_dob";
    type Error = ToolBridgeError;
    type Args = GetUserDobArgs;
    type Output = serde_json::Value;

    fn description(&self) -> String {
        "Get the date of birth (DOB) of a specific user by their name in YYYY-MM-DD format.".to_string()
    }

    fn parameters(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "name": { "type": "string", "description": "The full name of the user" }
            },
            "required": ["name"]
        })
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
    }
}
```

---

### C. Agent Multi-Turn & Multi-Tool Execution Loop (`src-tauri/src/llm/agent.rs`)

```rust
use rig::client::{CompletionClient, Nothing};
use rig::completion::message::{AssistantContent, ToolResultContent, UserContent};
use rig::completion::{CompletionModel, Message};
use rig::providers::ollama;
use rig::tool::{portable_tool_definition, PortableTool};
use tauri::AppHandle;

use super::pending::PendingRequests;
use super::tools::{
    GetUserAgeArgs, GetUserAgeTool, GetUserCountryArgs, GetUserCountryTool,
    GetUserDobArgs, GetUserDobTool, GetUserNameArgs, GetUserNameTool,
    SumFourDigitsArgs, SumFourDigitsTool,
};

const SYSTEM_PROMPT: &str = "\
You are a helpful and precise AI assistant. \
You have access to user database and utility tools:
- 'get_user_name': Look up user name.
- 'get_user_age': Get user's age.
- 'get_user_country': Get user's country.
- 'get_user_dob': Get user's date of birth.
- 'sum_four_digits': Sum 4 numbers.

IMPORTANT MULTI-TOOL RULES:
- When a user asks for multiple attributes at once (e.g. 'What is the age, country, and DOB of Alice?'), call all relevant tools in the same turn.
- Once all tool results are provided, immediately synthesize the final answer. Do not call additional unprompted tools.";

pub async fn prompt_agent(
    app: AppHandle,
    pending: PendingRequests,
    prompt: &str,
) -> Result<String, String> {
    let client = ollama::Client::new(Nothing).map_err(|e| e.to_string())?;
    let model = client.completion_model("qwen3.5:4b");

    let sum_tool = SumFourDigitsTool { app: app.clone(), pending: pending.clone() };
    let user_name_tool = GetUserNameTool { app: app.clone(), pending: pending.clone() };
    let user_age_tool = GetUserAgeTool { app: app.clone(), pending: pending.clone() };
    let user_country_tool = GetUserCountryTool { app: app.clone(), pending: pending.clone() };
    let user_dob_tool = GetUserDobTool { app: app.clone(), pending: pending.clone() };

    let tool_defs = vec![
        portable_tool_definition(&sum_tool),
        portable_tool_definition(&user_name_tool),
        portable_tool_definition(&user_age_tool),
        portable_tool_definition(&user_country_tool),
        portable_tool_definition(&user_dob_tool),
    ];

    // Seed history with initial user prompt so multi-turn loop retains full context
    let mut history: Vec<Message> = vec![Message::User {
        content: vec![UserContent::text(prompt)],
    }];

    // Multi-turn resolution loop
    for _turn in 0..4 {
        let request = model
            .completion_request("")
            .preamble(SYSTEM_PROMPT.to_string())
            .messages(history.clone())
            .tools(tool_defs.clone())
            .build();

        let response = model
            .completion(request)
            .await
            .map_err(|e| format!("Ollama completion error: {}", e))?;

        let mut has_tool_call = false;
        let mut text_parts = Vec::new();
        let mut assistant_contents = Vec::new();
        let mut tool_results_to_add = Vec::new();

        // Process all items in response.choice (handles single or multiple simultaneous tool calls)
        for content in response.choice {
            match content {
                AssistantContent::Text(t) => {
                    text_parts.push(t.text.clone());
                    assistant_contents.push(AssistantContent::Text(t));
                }
                AssistantContent::ToolCall(tool_call) => {
                    has_tool_call = true;
                    let call_name = tool_call.function.name.clone();
                    let call_id = tool_call.id.clone();
                    let provider_call_id = tool_call.provider.clone();

                    let tool_result_value = match call_name.as_str() {
                        "get_user_age" => {
                            let args: GetUserAgeArgs = serde_json::from_value(tool_call.function.arguments.clone())
                                .map_err(|e| e.to_string())?;
                            user_age_tool.call(args).await.map_err(|e| e.to_string())?
                        }
                        "get_user_country" => {
                            let args: GetUserCountryArgs = serde_json::from_value(tool_call.function.arguments.clone())
                                .map_err(|e| e.to_string())?;
                            user_country_tool.call(args).await.map_err(|e| e.to_string())?
                        }
                        "get_user_dob" => {
                            let args: GetUserDobArgs = serde_json::from_value(tool_call.function.arguments.clone())
                                .map_err(|e| e.to_string())?;
                            user_dob_tool.call(args).await.map_err(|e| e.to_string())?
                        }
                        "sum_four_digits" => {
                            let args: SumFourDigitsArgs = serde_json::from_value(tool_call.function.arguments.clone())
                                .map_err(|e| e.to_string())?;
                            sum_tool.call(args).await.map_err(|e| e.to_string())?
                        }
                        unknown => return Err(format!("Unknown tool: {}", unknown)),
                    };

                    assistant_contents.push(AssistantContent::ToolCall(tool_call));
                    let result_content = ToolResultContent::json(tool_result_value);
                    tool_results_to_add.push((call_id, provider_call_id, call_name, vec![result_content]));
                }
                other => assistant_contents.push(other),
            }
        }

        // If no tool was called, we have our final text answer
        if !has_tool_call {
            return Ok(text_parts.join("\n"));
        }

        // Record assistant turn in history
        history.push(Message::Assistant {
            id: None,
            content: assistant_contents,
        });

        // Record all tool results in history
        for (call_id, provider_call_id, call_name, contents) in tool_results_to_add {
            history.push(Message::User {
                content: vec![UserContent::tool_result_for(call_id, provider_call_id, call_name, contents)],
            });
        }
    }

    Err("Exceeded maximum tool calling turns".to_string())
}
```

---

### D. Module Root, Commands & Tauri Setup

```rust
// src-tauri/src/llm/mod.rs
pub mod agent;
pub mod commands;
pub mod pending;
pub mod tools;
```

```rust
// src-tauri/src/llm/commands.rs
use tauri::{AppHandle, State};
use super::agent::prompt_agent;
use super::pending::{PendingRequests, ToolResultResponse};

#[tauri::command]
pub async fn send_message(
    prompt: String,
    state: State<'_, PendingRequests>,
    app: AppHandle,
) -> Result<String, String> {
    let pending = (*state).clone();
    prompt_agent(app, pending, &prompt).await
}

#[tauri::command]
pub fn tool_result(
    request_id: String,
    result: ToolResultResponse,
    state: State<'_, PendingRequests>,
) -> Result<(), String> {
    state.resolve(&request_id, result);
    Ok(())
}
```

```rust
// src-tauri/src/lib.rs
mod llm;

use llm::commands::{send_message, tool_result};
use llm::pending::PendingRequests;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pending_requests = PendingRequests::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(pending_requests)
        .invoke_handler(tauri::generate_handler![send_message, tool_result])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 6. Frontend React / TypeScript Implementation

### A. Mock Users Database (`src/data/users.ts`)
```typescript
export interface UserRecord {
  id: number;
  name: string;
  age: number;
  country: string;
  dob: string;
}

export const USERS_DATABASE: UserRecord[] = [
  { id: 1, name: "Alice Smith", age: 28, country: "United States", dob: "1998-04-12" },
  { id: 2, name: "Bob Johnson", age: 34, country: "Canada", dob: "1992-09-23" },
  { id: 3, name: "Carlos Rossi", age: 41, country: "Italy", dob: "1985-01-15" },
  // ... 50 mock user records
];

export function findUser(query: string | number): UserRecord | undefined {
  if (typeof query === "number" || !isNaN(Number(query))) {
    return USERS_DATABASE.find((u) => u.id === Number(query));
  }
  const q = String(query).trim().toLowerCase();
  return USERS_DATABASE.find((u) => u.name.toLowerCase().includes(q));
}
```

---

### B. Parallel-Safe Tool Listener Hook (`src/hooks/useToolListener.ts`)
Handles simultaneous incoming `tool_request` events cleanly and prevents duplicate execution under React StrictMode.

```typescript
import { useEffect, useState, useRef } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getUserAge } from "../tools/getUserAge";
import { getUserCountry } from "../tools/getUserCountry";
import { getUserDob } from "../tools/getUserDob";

export interface ToolRequestPayload {
  request_id: string;
  tool_name: string;
  args: Record<string, unknown>;
}

export interface ToolExecutionLog {
  id: string;
  requestId: string;
  toolName: string;
  args: unknown;
  result?: unknown;
  status: "executing" | "success" | "error";
  error?: string;
  timestamp: Date;
}

export function useToolListener() {
  const [logs, setLogs] = useState<ToolExecutionLog[]>([]);
  const [activeToolCall, setActiveToolCall] = useState<ToolExecutionLog | null>(null);
  const processedRequestsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let isCancelled = false;
    let unlistenFn: UnlistenFn | null = null;

    listen<ToolRequestPayload>("tool_request", async (event) => {
      if (isCancelled) return;

      const { request_id, tool_name, args } = event.payload;

      // Deduplicate request handling
      if (processedRequestsRef.current.has(request_id)) return;
      processedRequestsRef.current.add(request_id);

      const logEntry: ToolExecutionLog = {
        id: crypto.randomUUID(),
        requestId: request_id,
        toolName: tool_name,
        args,
        status: "executing",
        timestamp: new Date(),
      };

      setActiveToolCall(logEntry);
      setLogs((prev) => [logEntry, ...prev]);

      try {
        let toolOutput: unknown;
        switch (tool_name) {
          case "get_user_age":
            toolOutput = getUserAge(args as { name: string });
            break;
          case "get_user_country":
            toolOutput = getUserCountry(args as { name: string });
            break;
          case "get_user_dob":
            toolOutput = getUserDob(args as { name: string });
            break;
          default:
            throw new Error(`Unknown tool: ${tool_name}`);
        }

        // Update card to Success immediately
        setLogs((prev) =>
          prev.map((l) =>
            l.requestId === request_id ? { ...l, result: toolOutput, status: "success" } : l
          )
        );
        setActiveToolCall(null);

        // Send output back to Rust
        await invoke("tool_result", {
          requestId: request_id,
          result: { Ok: toolOutput },
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setLogs((prev) =>
          prev.map((l) =>
            l.requestId === request_id ? { ...l, error: errorMsg, status: "error" } : l
          )
        );
        setActiveToolCall(null);

        await invoke("tool_result", {
          requestId: request_id,
          result: { Err: errorMsg },
        });
      }
    }).then((unlisten) => {
      if (isCancelled) {
        unlisten();
      } else {
        unlistenFn = unlisten;
      }
    });

    return () => {
      isCancelled = true;
      if (unlistenFn) {
        unlistenFn();
        unlistenFn = null;
      }
    };
  }, []);

  const clearLogs = () => {
    setLogs([]);
    processedRequestsRef.current.clear();
    setActiveToolCall(null);
  };

  const sortedLogs = [...logs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return { logs: sortedLogs, activeToolCall, clearLogs };
}
```

---

## 7. Critical Architectural Gotchas & Solutions

| Challenge | Cause | Solution |
|---|---|---|
| **Parallel Tool Execution** | Model emits multiple tool calls in one turn. | In Rust `agent.rs`, loop through all `response.choice` items, execute each tool call, append all outputs to `history`, and proceed to synthesis turn. |
| **React StrictMode Double Listeners** | `listen()` is async; React cleanup runs before promise resolves. | Chain `.then((unlisten) => { if (isCancelled) unlisten(); else unlistenFn = unlisten; })`. |
| **Model Hallucinating Extra Tool Calls** | Multi-turn loops lose the initial user prompt if omitted from persistent `history`. | Seed initial user prompt into `history` on turn 0 so the model has the full context. |
| **UI Freezing on Frontend Failure** | If a JS tool throws or fails to return, Rust would await indefinitely. | Wrap `rx.await` in `tokio::time::timeout(Duration::from_secs(15), rx)`. |
| **Ordering of Tool Logs** | Real-time events may arrive in quick succession. | Sort logs descending by `timestamp` (`b.timestamp - a.timestamp`) so newest events always appear at the top. |
