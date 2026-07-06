# AI Chat Integration — Local & Remote LLM with Tool Calling

## Overview

Integrate a fully-featured AI assistant into Depdok that supports:
- **Local inference**: GGUF models via `llama-cpp-2` (Metal on macOS, CUDA on Windows/Linux, CPU fallback)
- **Remote APIs**: Ollama, LM Studio (OpenAI-compatible), OpenAI, Anthropic Claude
- **Tool calling**: file read/write, shell commands, web search — executed by the Rust backend
- **Model management**: download/delete GGUF models from Hugging Face, stored in `src-tauri/models/` (bundled with the app; resolved via Tauri's resource path at runtime)
- **Chat UI**: floating panel (bottom-right) toggled via a new titlebar icon next to the terminal button
- **Settings tab**: new "AI Models" tab in the existing `SettingsDialog` for provider config + model management

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│ Titlebar — AiChatButton (next to terminal icon)            │
│  → toggles isChatOpenAtom                                  │
└──────────────────────────┬─────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────┐
│ AiChatPanel (fixed bottom-right, floating overlay)         │
│  Messages list (streaming) + input + tool call display     │
└──────────────────────────┬─────────────────────────────────┘
                           │ invoke / listen
┌──────────────────────────▼─────────────────────────────────┐
│ Rust: commands/llm.rs — LlmManager (Arc<Mutex<...>>)       │
│                                                            │
│  Provider Router                                           │
│  ┌──────────────┬──────────────────────────────────┐       │
│  │ Local Engine │ Remote Engine                    │       │
│  │ llama-cpp-2  │ HTTP client (reqwest)             │       │
│  │ GGUF files   │ Ollama / LM Studio / OpenAI /    │       │
│  │ Metal/CUDA   │ Claude (streaming SSE/chunks)    │       │
│  └──────────────┴──────────────────────────────────┘       │
│                                                            │
│  Tool Executor                                             │
│  ┌─────────────────────────────────────────────────┐       │
│  │ read_file · write_file · list_dir                 │       │
│  │ run_shell (sandboxed to workspace_root)           │       │
│  │ web_search (DuckDuckGo scraping, no key)          │       │
│  └─────────────────────────────────────────────────┘       │
│                                                            │
│  Chat Persistence                                          │
│  <workspace>/.depdok/chat/<session-id>/history.json        │
└────────────────────────────────────────────────────────────┘

Event bus (Tauri emit):
  "llm-token"   { content: string }     — streamed tokens
  "llm-tool"    { name, input, output } — tool call result
  "llm-done"    {}
  "llm-error"   { message: string }
```

---

## Key Design Decisions

### Provider abstraction
All providers share a common Rust trait:
```rust
#[async_trait]
trait LlmProvider: Send + Sync {
    async fn chat_stream(
        &self,
        messages: &[ChatMessage],
        tools: &[ToolDefinition],
        app: &AppHandle,
    ) -> Result<(), String>;
}
```
- `LocalProvider` — wraps `llama-cpp-2`
- `OllamaProvider` / `OpenAICompatProvider` — wrap `reqwest` + streaming SSE
- `ClaudeProvider` — wraps Anthropic SSE API

### Tool calling
The backend defines tools as JSON schemas (matching OpenAI's function-calling format). When the LLM emits a tool call:
1. Rust executes the tool locally
2. Result is emitted to frontend via `"llm-tool"` event and injected back as a `tool` role message
3. The LLM continues generating

### GGUF model management
- **Default model directory**: `src-tauri/models/` — resolved at runtime using Tauri's `app.path().resource_dir()` + `"models"`
- The folder is committed to the repo (empty, with a `.gitkeep`); users drop `.gguf` files there or use the in-app downloader
- Download via `reqwest` with progress events (`"llm-model-download-progress"`)
- Commands: `list_llm_models`, `download_llm_model`, `delete_llm_model`, `get_llm_models_dir`

> [!NOTE]
> Use `tauri::Manager::path().resource_dir()` to resolve the bundled `models/` path at runtime. In dev mode this points to `src-tauri/models/`; in a production build Tauri copies it to the app's resource bundle.

---

## Resolved Decisions

| # | Question | Decision |
|---|----------|----------|
| Q1 | Web search tool | **DuckDuckGo scraping** — no API key required, using DuckDuckGo HTML endpoint via `reqwest` |
| Q2 | Shell tool scope | **Workspace-sandboxed** — commands are only allowed to run with cwd inside the current workspace root |
| Q3 | Chat history | **Persisted to disk** — stored in `<workspace>/.depdok/chat/<session-id>/history.json`; each conversation is a folder |
| Q4 | GGUF model list | **Pre-curated** — a fixed list of recommended models (Qwen2.5, Llama3.2, Mistral, Phi-3.5, Gemma2) + custom URL input |

---

## Folder Structure

All LLM code lives in exactly two isolated locations. Nothing is scattered across the general `commands/`, `stores/`, or `api-client/` directories.

```
src-tauri/src/
└── llm/                          # NEW — self-contained LLM backend module
    ├── mod.rs                    # pub use + LlmState registration
    ├── engine.rs                 # LlamaEngine + LlamaConfig (from examples/rust-llama)
    ├── provider.rs               # LlmProvider trait + router (Local / Ollama / OpenAI / Claude)
    ├── remote.rs                 # reqwest-based streaming for Ollama, LM Studio, OpenAI, Claude
    ├── tools.rs                  # Tool definitions + executor (read_file, write_file, run_shell, web_search)
    ├── session.rs                # Chat history persistence (<workspace>/.depdok/chat/)
    ├── models.rs                 # GGUF model scanner + downloader (src-tauri/models/)
    └── commands.rs               # All #[tauri::command] handlers (thin wrappers over the above)

src-tauri/models/                 # Default GGUF model directory (committed, empty)
└── .gitkeep

src/features/LLMChat/             # NEW — self-contained frontend feature
    ├── api/
    │   └── llm.ts                # invoke/listen wrappers (replaces src/api-client/llm.ts)
    ├── store/
    │   └── LLMChatStore.ts       # Jotai atoms (UI, sessions, provider, models)
    ├── hooks/
    │   ├── useLlmStream.ts       # Token streaming lifecycle
    │   └── useLlmConfig.ts       # Load/save provider config
    ├── components/
    │   ├── LLMChatButton.tsx     # Titlebar icon (imported by Titlebar features)
    │   ├── LLMChatPanel.tsx      # Floating overlay panel
    │   ├── LLMChatMessage.tsx    # Individual message bubble
    │   ├── LLMChatToolCall.tsx   # Collapsible tool call display
    │   └── LLMChatInput.tsx      # Textarea + Send/Stop buttons
    ├── settings/
    │   └── LLMModelSetting.tsx   # Provider config + GGUF model manager (used inside SettingsDialog)
    └── index.ts                  # Public exports (LLMChatButton, LLMChatPanel, LLMModelSetting)
```

> [!NOTE]
> Only three external files are modified: `src-tauri/src/lib.rs` (registers `LlmState`), `src/features/SettingsDialog/SettingsDialog.tsx` (adds AI Models tab), and the two Titlebar components (add `<LLMChatButton />`). Everything else is new files inside the two feature folders.

---

## Proposed Changes

### Component 1 — Rust Backend (`src-tauri/src/llm/`)

#### [MODIFY] `src-tauri/Cargo.toml`

Based on `examples/rust-llama/Cargo.toml`:

```toml
[dependencies]
# Core llama.cpp bindings — metal + sampler features are both required
llama-cpp-2    = { version = "0.1", features = ["metal", "sampler"] }
llama-cpp-sys-2 = { version = "0.1" }  # raw FFI for llama_log_set (silence control)
encoding_rs    = "0.8"                  # stateful UTF-8 decoder for multi-byte tokens
scraper        = "0.19"                 # HTML parsing for DuckDuckGo results
```

> [!IMPORTANT]
> `metal` and `sampler` **must both** be declared in the same `features = [...]` list — splitting into a platform-specific target block causes feature deduplication issues with llama-cpp-2. On non-macOS targets, the Metal feature is safely ignored by llama.cpp.

> [!WARNING]
> `llama-cpp-2` compiles llama.cpp from source via `cmake`. Requires `cmake` + a C++ toolchain (`brew install cmake` on macOS). First build takes ~1–3 min; subsequent builds use the cached artifact.

#### [NEW] `src-tauri/src/llm/mod.rs`

The module root — re-exports public types and wires the commands:
```rust
pub mod commands;
pub mod engine;
pub mod models;
pub mod provider;
pub mod remote;
pub mod session;
pub mod tools;

pub use engine::{LlamaConfig, LlamaEngine};
pub use provider::{LlmConfig, LlmState, ProviderType};
```

#### [NEW] `src-tauri/src/llm/engine.rs`

Copy-paste of `LlamaEngine` + `LlamaConfig` from `examples/rust-llama/src/main.rs` (already verified working). No changes needed — just relocated into the module.

#### [NEW] `src-tauri/src/llm/provider.rs`

Contains `LlmState`, `LlmConfig`, `ProviderType`, and the `LlmProvider` routing logic:
```rust
pub struct LlmState {
    pub engine: Mutex<Option<Arc<LlamaEngine>>>,
    pub config: Mutex<LlmConfig>,
    pub cancel: Arc<AtomicBool>,
}

pub struct LlmConfig {
    pub provider_type:    ProviderType,
    pub local_model_path: Option<String>,
    pub api_endpoint:     Option<String>,
    pub api_key:          Option<String>,
    pub model_name:       Option<String>,
    pub gpu_layers:       u32,
    pub ctx_size:         u32,
    pub max_tokens:       i32,
}

pub enum ProviderType { Local, Ollama, LmStudio, OpenAI, Claude }
```

#### [NEW] `src-tauri/src/llm/remote.rs`

`reqwest`-based streaming client for Ollama / LM Studio / OpenAI / Claude. Emits `llm-token` events via `AppHandle::emit` using SSE/chunked response parsing.

#### [NEW] `src-tauri/src/llm/tools.rs`

Tool schema definitions (OpenAI JSON format) and executor:
- `read_file(path)` — reads file content
- `write_file(path, content)` — writes content to file
- `list_directory(path)` — lists files/dirs
- `run_shell(command)` — sandboxed to `workspace_root`; rejected if cwd would escape workspace
- `web_search(query)` — scrapes `https://html.duckduckgo.com/html/?q=...` via `reqwest` + `scraper`

#### [NEW] `src-tauri/src/llm/session.rs`

Chat history persistence to `<workspace>/.depdok/chat/<session-id>/history.json`.

#### [NEW] `src-tauri/src/llm/models.rs`

GGUF model management — scan `src-tauri/models/` (resolved via `resource_dir()`), download via `reqwest` with progress events, delete.

#### [NEW] `src-tauri/src/llm/commands.rs`

All `#[tauri::command]` handlers — thin wrappers that delegate to the sub-modules above.
**`LlamaEngine` & `LlamaConfig` (ported directly from `examples/rust-llama/src/main.rs`):**

The local inference engine is a self-contained struct that wraps `llama-cpp-2`. Copy `LlamaEngine` and `LlamaConfig` verbatim from the example (they are not a crate, just proven copy-paste code):

```rust
use llama_cpp_2::{
    context::params::LlamaContextParams,
    llama_backend::LlamaBackend,
    llama_batch::LlamaBatch,
    model::{params::LlamaModelParams, AddBos, LlamaModel},
    sampling::LlamaSampler,
};
use std::ffi::c_void;
use std::num::NonZeroU32;

/// Suppress ALL internal llama.cpp / ggml / Metal logs — installed before backend init.
extern "C" fn noop_log(
    _level: llama_cpp_sys_2::ggml_log_level,
    _text: *const std::ffi::c_char,
    _user_data: *mut c_void,
) {}

pub struct LlamaConfig {
    pub gpu_layers: u32,   // u32::MAX = all layers on GPU (Apple Silicon default)
    pub ctx_size:   u32,   // KV-cache context window in tokens (default 2048)
    pub max_tokens: i32,   // max generated tokens per call (default 512)
    pub silent:     bool,  // suppress llama.cpp logs (default true)
}

impl Default for LlamaConfig {
    fn default() -> Self {
        Self { gpu_layers: u32::MAX, ctx_size: 2048, max_tokens: 512, silent: true }
    }
}
// builder methods: .gpu_layers() .ctx_size() .max_tokens() .silent()

pub struct LlamaEngine {
    backend: LlamaBackend,
    model:   LlamaModel,
    config:  LlamaConfig,
}

impl LlamaEngine {
    /// Load a GGUF model. Installs noop_log BEFORE backend init to silence Metal noise.
    pub fn load(path: impl AsRef<std::path::Path>, config: LlamaConfig)
        -> Result<Self, Box<dyn std::error::Error>>
    {
        if config.silent {
            unsafe { llama_cpp_sys_2::llama_log_set(Some(noop_log), std::ptr::null_mut()); }
        }
        let backend = LlamaBackend::init()?;
        let model_params = LlamaModelParams::default().with_n_gpu_layers(config.gpu_layers);
        let model = LlamaModel::load_from_file(&backend, path, &model_params)?;
        Ok(Self { backend, model, config })
    }

    /// Collect full response as a String.
    pub fn generate(&self, prompt: &str) -> Result<String, Box<dyn std::error::Error>> {
        let mut out = String::new();
        self.stream(prompt, |piece| { out.push_str(piece); Ok(true) })?;
        Ok(out)
    }

    /// Stream token-by-token. Return Ok(false) from closure to stop early (cancellation).
    pub fn stream(
        &self,
        prompt: &str,
        mut on_token: impl FnMut(&str) -> Result<bool, Box<dyn std::error::Error>>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let ctx_params = LlamaContextParams::default()
            .with_n_ctx(Some(NonZeroU32::new(self.config.ctx_size).unwrap()));
        let mut ctx = self.model.new_context(&self.backend, ctx_params)?;
        let tokens = self.model.str_to_token(prompt, AddBos::Always)?;
        let mut batch = LlamaBatch::new(tokens.len().max(512), 1);
        let last = (tokens.len() - 1) as i32;
        for (i, &tok) in tokens.iter().enumerate() {
            batch.add(tok, i as i32, &[0], i as i32 == last)?;
        }
        ctx.decode(&mut batch)?;
        let mut sampler = LlamaSampler::greedy();
        let mut decoder = encoding_rs::UTF_8.new_decoder();
        let mut n = batch.n_tokens();
        while n <= self.config.max_tokens {
            let token = sampler.sample(&ctx, -1);
            if self.model.is_eog_token(token) { break; }
            let piece = self.model.token_to_piece(token, &mut decoder, false, None)?;
            if !on_token(&piece)? { break; }  // ← returning Ok(false) is cancellation
            batch.clear();
            batch.add(token, n, &[0], true)?;
            ctx.decode(&mut batch)?;
            n += 1;
        }
        Ok(())
    }
}
```

> [!NOTE]
> `LlamaEngine::stream()` is **synchronous**. In Tauri commands, wrap it with `tokio::task::spawn_blocking` so it doesn't block the async executor:
> ```rust
> #[tauri::command]
> async fn send_chat_message(app: AppHandle, /* ... */) -> Result<(), String> {
>     let engine = /* clone Arc<LlamaEngine> from state */;
>     tokio::task::spawn_blocking(move || {
>         engine.stream(&prompt, |piece| {
>             app.emit("llm-token", piece).ok();
>             Ok(!*cancel_flag.load()) // AtomicBool for cancellation
>         })
>     }).await.map_err(|e| e.to_string())?;
>     app.emit("llm-done", ()).ok();
>     Ok(())
> }
> ```

**State & Config types:**
```rust
pub struct LlmState {
    pub engine: Mutex<Option<Arc<LlamaEngine>>>,  // local engine; None = not loaded
    pub config: Mutex<LlmConfig>,
    pub cancel: Arc<AtomicBool>,                  // set true to abort stream via Ok(false)
}

pub struct LlmConfig {
    pub provider_type:    ProviderType,  // Local | Ollama | LmStudio | OpenAI | Claude
    pub local_model_path: Option<String>,
    pub api_endpoint:     Option<String>,
    pub api_key:          Option<String>,
    pub model_name:       Option<String>,
    // LlamaConfig fields (gpu_layers, ctx_size, max_tokens) exposed for settings UI
    pub gpu_layers:       u32,
    pub ctx_size:         u32,
    pub max_tokens:       i32,
}

pub enum ProviderType { Local, Ollama, LmStudio, OpenAI, Claude }
```

**Tauri Commands:**
| Command | Description |
|---------|-------------|
| `get_llm_config()` | Returns current provider config |
| `save_llm_config(config)` | Persists config to `store.json` |
| `load_llm_provider()` | Instantiates the provider from config |
| `unload_llm_provider()` | Frees local model from memory |
| `get_llm_provider_status()` | `{ loaded, provider_type, model_name }` |
| `send_chat_message(messages, workspace_root, session_id)` | Starts streaming; persists history; emits `llm-token`, `llm-tool`, `llm-done` |
| `cancel_generation()` | Cancels in-flight generation |
| `list_chat_sessions(workspace_root)` | Lists session folders in `<workspace>/.depdok/chat/` |
| `load_chat_session(workspace_root, session_id)` | Loads `history.json` for a session |
| `delete_chat_session(workspace_root, session_id)` | Deletes a session folder |
| `scan_local_llm_models()` | Scans `src-tauri/models/` (resolved via `resource_dir()`) for `.gguf` files → `Vec<GgufModelInfo>` |
| `download_llm_model(url, filename)` | Downloads GGUF with progress events (`llm-model-download-progress`) |
| `delete_llm_model(filename)` | Removes file from models dir |
| `reveal_llm_models_dir()` | Opens dir in Finder/Explorer |

**Cancellation:** `cancel_generation()` command sets `LlmState.cancel` (`AtomicBool`) to `true`. The `spawn_blocking` closure checks this flag and returns `Ok(false)` from the `on_token` callback, causing `LlamaEngine::stream()` to break cleanly.

**Tool definitions (always sent to providers that support function calling):**
- `read_file(path)` — reads file content (any absolute path)
- `write_file(path, content)` — writes content to file
- `list_directory(path)` — lists files/dirs
- `run_shell(command)` — executes shell command sandboxed to `workspace_root`; command is rejected if resolved cwd would escape the workspace
- `web_search(query)` — scrapes DuckDuckGo HTML endpoint (`https://html.duckduckgo.com/html/?q=...`) via `reqwest`, parses top N result snippets + URLs, returns as structured JSON; no API key required

#### [MODIFY] `src-tauri/src/lib.rs`
- `app.manage(LlmState::new())` in `setup()`
- Register all `llm::commands::*` in `invoke_handler![]`

---

### Component 2 — Frontend API (`src/features/LLMChat/api/`)

#### [NEW] `src/features/LLMChat/api/llm.ts`
Tauri `invoke`/`listen` wrappers — co-located with the feature instead of in the global `src/api-client/`:
```ts
// Provider & config
export const getLlmConfig(): Promise<LlmConfig>
export const saveLlmConfig(config: LlmConfig): Promise<void>
export const loadLlmProvider(): Promise<void>
export const unloadLlmProvider(): Promise<void>
export const getLlmProviderStatus(): Promise<LlmProviderStatus>

// Chat
export const sendChatMessage(
  messages: ChatMessage[],
  workspaceRoot: string,
  sessionId: string
): Promise<void>
export const cancelGeneration(): Promise<void>

// Session management
export const listChatSessions(workspaceRoot: string): Promise<ChatSessionMeta[]>
export const loadChatSession(workspaceRoot: string, sessionId: string): Promise<ChatSession>
export const deleteChatSession(workspaceRoot: string, sessionId: string): Promise<void>

// Model management
export const scanLocalLlmModels(): Promise<GgufModelInfo[]>
export const downloadLlmModel(url: string, filename: string): Promise<void>
export const deleteLlmModel(filename: string): Promise<void>
export const revealLlmModelsDir(): Promise<void>
export const getLlmModelsDir(): Promise<string>

// Event listeners
export const onLlmToken(cb: (token: string) => void): Promise<UnlistenFn>
export const onLlmTool(cb: (event: ToolCallEvent) => void): Promise<UnlistenFn>
export const onLlmDone(cb: () => void): Promise<UnlistenFn>
export const onLlmError(cb: (msg: string) => void): Promise<UnlistenFn>
export const onLlmModelDownloadProgress(cb: (pct: number) => void): Promise<UnlistenFn>
```

---

### Component 3 — State Management (`src/features/LLMChat/store/`)

#### [NEW] `src/features/LLMChat/store/LLMChatStore.ts`
Co-located Jotai store — not placed in the global `src/stores/`:
```ts
// UI state
export const isChatOpenAtom = atom(false)

// Session state
export const currentSessionIdAtom = atom<string>(generateSessionId)  // uuid, set on first open
export const chatMessagesAtom = atom<ChatMessage[]>([])
export const isGeneratingAtom = atom(false)
export const activeToolCallAtom = atom<ToolCallEvent | null>(null)
export const chatSessionsAtom = atom<ChatSessionMeta[]>([])  // list of past sessions

// Provider state
export const llmProviderStatusAtom = atom<LlmProviderStatus | null>(null)
export const llmConfigAtom = atom<LlmConfig | null>(null)

// Model management
export const localGgufModelsAtom = atom<GgufModelInfo[]>([])
export const modelDownloadProgressAtom = atom<number | null>(null)
```

**Chat persistence schema** (`<workspace>/.depdok/chat/<session-id>/history.json`):
```json
{
  "id": "2026-07-06T00-01-23_abc123",
  "created_at": "2026-07-06T00:01:23Z",
  "model": "qwen2.5-7b-instruct",
  "provider": "local",
  "messages": [
    { "role": "user",      "content": "...", "timestamp": "..." },
    { "role": "assistant", "content": "...", "timestamp": "..." },
    { "role": "tool",      "name": "web_search", "input": {...}, "output": {...} }
  ]
}
```

---

### Component 4 — LLM Chat UI (`src/features/LLMChat/components/` + `hooks/`)

#### [NEW] `src/features/LLMChat/components/LLMChatButton.tsx`
Small icon button (e.g., `PiChatCircleText`). Imported by Titlebar features via `src/features/LLMChat/index.ts`. Toggles `isChatOpenAtom`.

#### [NEW] `src/features/LLMChat/components/LLMChatPanel.tsx`
Fixed bottom-right overlay (`position: fixed`, `z-index` above editor). Contains:
- Header: model name badge + provider badge + close button
- Message list: user/assistant/tool-result bubbles, auto-scrolls
- Streaming: tokens appended live to last assistant bubble
- Tool call display: collapsible block showing `🔧 ran list_directory("src/")` with output
- Footer: `<LLMChatInput />` component

#### [NEW] `src/features/LLMChat/components/LLMChatMessage.tsx`
Individual message bubble. Handles: `user`, `assistant`, `tool` roles + streaming state.

#### [NEW] `src/features/LLMChat/components/LLMChatToolCall.tsx`
Collapsible display for tool call events: tool name, input args, output result.

#### [NEW] `src/features/LLMChat/components/LLMChatInput.tsx`
Textarea + Send button (disabled during generation) + Stop button.

#### [NEW] `src/features/LLMChat/hooks/useLlmStream.ts`
Hook that manages the full streaming lifecycle:
- Subscribes to `llm-token`, `llm-tool`, `llm-done`, `llm-error` on mount
- Appends tokens to the streaming message
- Updates `activeToolCallAtom`
- Sets `isGeneratingAtom` correctly
- Cleans up listeners on unmount

#### [NEW] `src/features/LLMChat/hooks/useLlmConfig.ts`
Hook for loading and saving provider config (`getLlmConfig`, `saveLlmConfig`, `loadLlmProvider`).

#### [NEW] `src/features/LLMChat/index.ts`
Public barrel export — the only import surface for external features:
```ts
export { LLMChatButton } from './components/LLMChatButton'
export { LLMChatPanel }  from './components/LLMChatPanel'
export { LLMModelSetting } from './settings/LLMModelSetting'
```

---

### Component 5 — Settings: "AI Models" Tab

#### [MODIFY] `src/features/SettingsDialog/SettingsDialog.tsx`
Add a new `"ai-models"` tab (using `Bot` icon, already imported):
```ts
{ id: "ai-models", name: "AI Models", icon: Bot, desc: "Configure LLM providers and manage local models" }
```
Imports `<LLMModelSetting />` from `src/features/LLMChat`.

#### [NEW] `src/features/LLMChat/settings/LLMModelSetting.tsx`

**Section 1 — Provider Configuration** (tab switcher: Local / Ollama / LM Studio / OpenAI / Claude):
- **Local**: model folder path display + browse button + GGUF model selector dropdown
- **Ollama**: endpoint input (default `http://localhost:11434`) + model name input + test connection button
- **LM Studio**: endpoint input (default `http://localhost:1234`) + model name input + test connection button  
- **OpenAI**: API key input (masked) + model selector (gpt-4o, gpt-4-turbo, gpt-3.5-turbo) + custom endpoint override
- **Claude**: API key input (masked) + model selector (claude-3-5-sonnet, claude-3-opus, claude-3-haiku)

Save button applies config and loads the provider (calls `loadLlmProvider()`).

**Section 2 — Local GGUF Model Manager** (visible on all tabs, since local models can be pre-downloaded):
Table UI identical to `EmbeddingModelSetting`'s model table:

| Column | Content |
|--------|---------|
| Radio | Selected for local inference |
| Model Name | name + HuggingFace link |
| Quant | Q4_K_M, Q5_K_M, etc. |
| Size | GB |
| Status | Downloaded / Not Downloaded + download/delete actions |

**Pre-curated GGUF model list** (hardcoded in `AiModelSetting.tsx`, same pattern as `LOCAL_MODELS` in `EmbeddingModelSetting.tsx`):

| Model | Quant | Size | Strengths | HuggingFace Repo |
|-------|-------|------|-----------|------------------|
| Qwen2.5-7B-Instruct | Q4_K_M | ~4.7 GB | Multilingual, tool calling, coding | `Qwen/Qwen2.5-7B-Instruct-GGUF` |
| Qwen2.5-3B-Instruct | Q4_K_M | ~2.0 GB | Lightweight multilingual, fast | `Qwen/Qwen2.5-3B-Instruct-GGUF` |
| Llama-3.2-3B-Instruct | Q4_K_M | ~2.0 GB | Fast, strong reasoning | `bartowski/Llama-3.2-3B-Instruct-GGUF` |
| Llama-3.1-8B-Instruct | Q4_K_M | ~4.9 GB | Best open-weights balance | `bartowski/Meta-Llama-3.1-8B-Instruct-GGUF` |
| Mistral-7B-Instruct-v0.3 | Q4_K_M | ~4.1 GB | Strong coding + instruction | `TheBloke/Mistral-7B-Instruct-v0.3-GGUF` |
| Phi-3.5-mini-instruct | Q4_K_M | ~2.2 GB | Ultra-fast on CPU, small RAM | `bartowski/Phi-3.5-mini-instruct-GGUF` |
| gemma-2-2b-it | Q4_K_M | ~1.6 GB | Minimal footprint | `bartowski/gemma-2-2b-it-GGUF` |
| DeepSeek-Coder-V2-Lite | Q4_K_M | ~8.9 GB | Best code generation | `bartowski/DeepSeek-Coder-V2-Lite-Instruct-GGUF` |

Users can also paste any direct `.gguf` download URL via an **"Add Custom Model"** row at the bottom of the table.

---

### Component 6 — Titlebar Integration

#### [MODIFY] `src/features/Titlebar/MacOSTitlebar.tsx`
Import `{ LLMChatButton }` from `src/features/LLMChat` and add it next to the terminal toggle button (right section, before settings).

#### [MODIFY] `src/features/Titlebar/WindowsTitlebar.tsx`
Same as above.

---

### Component 8 — Markdown AI Grammar Correction

This feature builds on top of the LLM backend once it is working. It adds an AI icon to the existing `MarkdownBubbleMenu` that triggers a grammar/style correction on the currently selected text.

#### Flow

```
User selects text in editor
  → BubbleMenu appears
  → User clicks ✨ AI button
  → useGrammarCorrect hook calls grammar_correct_text(text) via invoke
  → Rust: LlmState generates corrected text (non-streaming, returns full string)
  → Hook receives corrected text
  → editor.commands.insertContentAt(selection, correctedText)
  → Original selection replaced with corrected text
```

#### [MODIFY] `src/features/PreviewMarkdown/MarkdownBubbleMenu.tsx`

Add an AI icon button (e.g. `PiMagicWand` or `PiSparkle`) after `<FormatButtons />`. The button:
- Shows a spinner while correction is in progress (`isCorrectingAtom` or local state)
- On click: calls `correctGrammar(editor.state.selection)` from `useGrammarCorrect` hook
- On success: replaces selection in TipTap editor via `editor.commands.insertContentAt`
- On error: shows a brief toast

```tsx
import { useGrammarCorrect } from "../LLMChat/hooks/useGrammarCorrect";

// inside MarkdownBubbleMenu:
const { correct, isCorrecting } = useGrammarCorrect(editor);

<button onClick={correct} disabled={isCorrecting} title="Fix grammar with AI">
  {isCorrecting ? <Spinner /> : <PiMagicWand />}
</button>
```

#### [NEW] `src/features/LLMChat/hooks/useGrammarCorrect.ts`

Hook co-located in `LLMChat/hooks/`. Responsibilities:
- Gets the selected text from `editor.state.doc.textBetween(from, to)`
- Calls `invoke("grammar_correct_text", { text: selectedText })` → returns `Promise<string>`
- Applies the result back: `editor.commands.insertContentAt({ from, to }, correctedText)`
- Manages `isCorrecting` boolean state
- Handles errors (logs + optional toast)

```ts
export function useGrammarCorrect(editor: Editor | null) {
  const [isCorrecting, setIsCorrecting] = useState(false);

  const correct = useCallback(async () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, " ");
    if (!text.trim()) return;

    setIsCorrecting(true);
    try {
      const corrected = await invoke<string>("grammar_correct_text", { text });
      editor.commands.insertContentAt({ from, to }, corrected);
    } catch (e) {
      console.error("Grammar correct failed:", e);
    } finally {
      setIsCorrecting(false);
    }
  }, [editor]);

  return { correct, isCorrecting };
}
```

#### [NEW] `src-tauri/src/llm/commands.rs` — `grammar_correct_text`

A new non-streaming command added alongside the chat commands:

```rust
#[tauri::command]
pub async fn grammar_correct_text(
    text: String,
    state: tauri::State<'_, LlmState>,
) -> Result<String, String> {
    let prompt = format!(
        "Fix the grammar and style of the following text. \
         Return ONLY the corrected text with no explanation, \
         no quotes, and no extra commentary:\n\n{text}"
    );

    // For local provider: use LlamaEngine::generate() (non-streaming, returns full string)
    // For remote providers: single HTTP request, parse response content field
    let engine = state.engine.lock().unwrap();
    match engine.as_ref() {
        Some(e) => e.generate(&prompt).map_err(|e| e.to_string()),
        None => Err("No LLM provider loaded".into()),
    }
}
```

> [!NOTE]
> `grammar_correct_text` uses `generate()` (blocking, returns full string) rather than `stream()`. It runs in a `spawn_blocking` block for the same reason as the chat commands.

---

### Component 9 — Root Layout

#### [MODIFY] `src/App.tsx`
Import `{ LLMChatPanel }` from `src/features/LLMChat` and render it at the root level (outside router, persistent overlay), controlled by `isChatOpenAtom`.

---

## File Map

### Backend — `src-tauri/src/llm/` (all new)

| File | Purpose |
|------|---------|
| `src-tauri/Cargo.toml` | Add `llama-cpp-2` (metal+sampler), `llama-cpp-sys-2`, `encoding_rs`, `scraper` |
| `src-tauri/src/llm/mod.rs` | Module root — re-exports, `LlmState` constructor |
| `src-tauri/src/llm/engine.rs` | `LlamaEngine` + `LlamaConfig` (from examples/rust-llama) |
| `src-tauri/src/llm/provider.rs` | `LlmState`, `LlmConfig`, `ProviderType` |
| `src-tauri/src/llm/remote.rs` | HTTP streaming client (Ollama / LM Studio / OpenAI / Claude) |
| `src-tauri/src/llm/tools.rs` | Tool schema definitions + executor |
| `src-tauri/src/llm/session.rs` | Chat history persistence |
| `src-tauri/src/llm/models.rs` | GGUF model scanner + downloader |
| `src-tauri/src/llm/commands.rs` | All `#[tauri::command]` handlers |
| `src-tauri/src/lib.rs` | Register `LlmState` + `llm::commands::*` |

### Frontend — `src/features/LLMChat/` (all new)

| File | Purpose |
|------|---------|
| `src/features/LLMChat/api/llm.ts` | Tauri `invoke`/`listen` wrappers |
| `src/features/LLMChat/store/LLMChatStore.ts` | Jotai atoms (UI, sessions, provider, models) |
| `src/features/LLMChat/hooks/useLlmStream.ts` | Token streaming lifecycle |
| `src/features/LLMChat/hooks/useLlmConfig.ts` | Provider config load/save |
| `src/features/LLMChat/hooks/useGrammarCorrect.ts` | Grammar correction hook for Markdown editor |
| `src/features/LLMChat/components/LLMChatButton.tsx` | Titlebar icon |
| `src/features/LLMChat/components/LLMChatPanel.tsx` | Floating chatbox |
| `src/features/LLMChat/components/LLMChatMessage.tsx` | Message bubble |
| `src/features/LLMChat/components/LLMChatToolCall.tsx` | Tool call display |
| `src/features/LLMChat/components/LLMChatInput.tsx` | Textarea + send/stop |
| `src/features/LLMChat/settings/LLMModelSetting.tsx` | Provider config + model manager |
| `src/features/LLMChat/index.ts` | Public barrel export |

### External files touched (modifications only)

| File | Change |
|------|---------|
| `src/features/SettingsDialog/SettingsDialog.tsx` | Add "AI Models" tab; import `LLMModelSetting` |
| `src/features/Titlebar/MacOSTitlebar.tsx` | Import + add `<LLMChatButton />` |
| `src/features/Titlebar/WindowsTitlebar.tsx` | Import + add `<LLMChatButton />` |
| `src/features/PreviewMarkdown/MarkdownBubbleMenu.tsx` | Add AI grammar-correct icon button |
| `src/App.tsx` | Mount `<LLMChatPanel />` globally |

---

## Implementation Order

1. **`src-tauri/src/llm/engine.rs`** — copy `LlamaEngine`+`LlamaConfig` from `examples/rust-llama`
2. **`src-tauri/src/llm/provider.rs`** — state types
3. **`src-tauri/src/llm/remote.rs`** — HTTP streaming for remote providers
4. **`src-tauri/src/llm/tools.rs`** — tool executor
5. **`src-tauri/src/llm/session.rs`** — chat persistence
6. **`src-tauri/src/llm/models.rs`** — GGUF scanner + downloader
7. **`src-tauri/src/llm/commands.rs`** + **`mod.rs`** — wire commands (incl. `grammar_correct_text`)
8. **`Cargo.toml`** + **`lib.rs`** — deps + state registration
9. **`LLMChat/api/llm.ts`** — Tauri wrappers
10. **`LLMChat/store/LLMChatStore.ts`** — atoms
11. **`LLMChat/settings/LLMModelSetting.tsx`** — settings UI + model downloader
12. **`SettingsDialog.tsx`** — add AI Models tab
13. **`LLMChat/components/*`** + **`hooks/useLlmStream.ts`** + **`hooks/useLlmConfig.ts`** — panel, messages, tool call, stream hook
14. **Titlebars** + **`App.tsx`** — wire button + panel
15. **`LLMChat/hooks/useGrammarCorrect.ts`** — grammar correct hook
16. **`MarkdownBubbleMenu.tsx`** — add AI icon button

---

## Verification Plan

### Build
- `pnpm app-dev` compiles Rust + TS without errors
- `llama-cpp-2` links with Metal on macOS

### Manual Tests
| Test | Expected |
|------|----------|
| Chat icon appears in titlebar | ✅ Next to terminal toggle |
| Click icon → panel opens bottom-right | ✅ Floating overlay |
| Settings → AI Models tab | ✅ Provider switcher + model table |
| Download a GGUF model | ✅ Progress bar → "Downloaded" badge |
| Switch to Local, select model, Save | ✅ `LlamaEngine::load()` succeeds; log shows `offloaded N/N layers to GPU` when `silent(false)` |
| Send a message → streaming response | ✅ `llm-token` events arrive via `spawn_blocking`; tokens appear live in bubble |
| LLM triggers `read_file` tool | ✅ Tool block shown in chat bubble |
| LLM triggers `run_shell` tool | ✅ Shell output shown; rejected if outside workspace |
| LLM triggers `web_search` tool | ✅ DuckDuckGo results shown, no API key prompt |
| Configure Ollama endpoint + send | ✅ Response streams from local Ollama |
| Configure LM Studio endpoint + send | ✅ Response streams from LM Studio |
| Configure OpenAI key + send | ✅ GPT-4o streams |
| Configure Claude key + send | ✅ Claude streams |
| Restart app, reopen chat | ✅ Past sessions listed; clicking one loads history |
| `.depdok/chat/<id>/history.json` exists | ✅ File created after first message sent |
| Select text in Markdown editor | ✅ BubbleMenu appears with ✨ AI button |
| Click AI button → spinner shown | ✅ `isCorrecting = true`; button disabled |
| Grammar corrected text replaces selection | ✅ `editor.commands.insertContentAt` applied |
| Click AI button with no provider loaded | ✅ Error toast; no crash |
