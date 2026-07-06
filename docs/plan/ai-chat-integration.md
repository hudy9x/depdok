# AI Chat Integration — Local & Remote LLM with Tool Calling

## Overview

Integrate a fully-featured AI assistant into Depdok that supports:
- **Local inference**: GGUF models via `llama-cpp-2` (Metal on macOS, CUDA on Windows/Linux, CPU fallback)
- **Remote APIs**: Ollama, LM Studio (OpenAI-compatible), OpenAI, Anthropic Claude
- **Tool calling**: file read/write, shell commands, web search — executed by the Rust backend
- **Model management**: download/delete GGUF models from Hugging Face, stored in the app's cache dir (mirrors `EmbeddingModelSetting`)
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
Same pattern as `EmbeddingModelSetting`:
- Models stored in `<app_cache_dir>/llm-models/`
- Download via `reqwest` with progress events (`"llm-model-download-progress"`)
- Commands: `list_llm_models`, `download_llm_model`, `delete_llm_model`, `get_llm_models_dir`

---

## Resolved Decisions

| # | Question | Decision |
|---|----------|----------|
| Q1 | Web search tool | **DuckDuckGo scraping** — no API key required, using DuckDuckGo HTML endpoint via `reqwest` |
| Q2 | Shell tool scope | **Workspace-sandboxed** — commands are only allowed to run with cwd inside the current workspace root |
| Q3 | Chat history | **Persisted to disk** — stored in `<workspace>/.depdok/chat/<session-id>/history.json`; each conversation is a folder |
| Q4 | GGUF model list | **Pre-curated** — a fixed list of recommended models (Qwen2.5, Llama3.2, Mistral, Phi-3.5, Gemma2) + custom URL input |

---

## Proposed Changes

### Component 1 — Rust Backend

#### [MODIFY] `src-tauri/Cargo.toml`
```toml
[dependencies]
llama-cpp-2 = { version = "0.1", features = [] }
scraper = "0.19"   # HTML parsing for DuckDuckGo results

# macOS Metal acceleration
[target.'cfg(target_os = "macos")'.dependencies]  
llama-cpp-2 = { version = "0.1", features = ["metal"] }
```
> [!WARNING]
> `llama-cpp-2` compiles the full llama.cpp C++ library. Requires `cmake` + a C++ toolchain. Adds ~1–3 min to first build.

#### [NEW] `src-tauri/src/commands/llm.rs`

**State & Types:**
```rust
pub struct LlmState {
    pub provider: Mutex<Option<Box<dyn LlmProvider>>>,
    pub config: Mutex<LlmConfig>,
}

pub struct LlmConfig {
    pub provider_type: ProviderType,  // Local | Ollama | LmStudio | OpenAI | Claude
    pub local_model_path: Option<String>,
    pub api_endpoint: Option<String>,
    pub api_key: Option<String>,
    pub model_name: Option<String>,
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
| `scan_local_llm_models()` | Scans `<cache>/llm-models/` for `.gguf` files → `Vec<GgufModelInfo>` |
| `download_llm_model(url, filename)` | Downloads GGUF with progress events (`llm-model-download-progress`) |
| `delete_llm_model(filename)` | Removes file from models dir |
| `reveal_llm_models_dir()` | Opens dir in Finder/Explorer |

**Tool definitions (always sent to providers that support function calling):**
- `read_file(path)` — reads file content (any absolute path)
- `write_file(path, content)` — writes content to file
- `list_directory(path)` — lists files/dirs
- `run_shell(command)` — executes shell command sandboxed to `workspace_root`; command is rejected if resolved cwd would escape the workspace
- `web_search(query)` — scrapes DuckDuckGo HTML endpoint (`https://html.duckduckgo.com/html/?q=...`) via `reqwest`, parses top N result snippets + URLs, returns as structured JSON; no API key required

#### [MODIFY] `src-tauri/src/commands/mod.rs`
Add `pub mod llm;`

#### [MODIFY] `src-tauri/src/lib.rs`
- `app.manage(LlmState::new())` in `setup()`
- Register all `commands::llm::*` commands in `invoke_handler![]`

---

### Component 2 — Frontend API Client

#### [NEW] `src/api-client/llm.ts`
Follows the exact same pattern as `knowledge-base.ts` (plain `invoke` + `listen` wrappers):
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

### Component 3 — State Management

#### [NEW] `src/stores/AiChatStore.ts`
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

### Component 4 — AI Chat Feature

**`src/features/AiChat/` directory:**

#### [NEW] `AiChatButton.tsx`
Small icon button (e.g., `PiChatCircleText` from `react-icons/pi`), placed next to terminal toggle in both titlebars. Toggles `isChatOpenAtom`.

#### [NEW] `AiChatPanel.tsx`
Fixed bottom-right overlay (`position: fixed`, `z-index` above editor). Contains:
- Header: model name badge + provider badge + close button
- Message list: user/assistant/tool-result bubbles, auto-scrolls
- Streaming: tokens appended live to last assistant bubble
- Tool call display: collapsible block showing `🔧 ran list_directory("src/")` with output
- Footer: textarea input + Send button (disabled during generation) + Stop button

#### [NEW] `AiChatMessage.tsx`
Individual message bubble component. Handles: `user`, `assistant`, `tool` roles + streaming state.

#### [NEW] `AiChatToolCall.tsx`
Collapsible display for tool call events: tool name, input args, output result.

#### [NEW] `useLlmStream.ts`  
Hook that manages the full lifecycle:
- Subscribes to `llm-token`, `llm-tool`, `llm-done`, `llm-error` on mount
- Appends tokens to the streaming message
- Updates `activeToolCallAtom`
- Sets `isGeneratingAtom` correctly
- Cleans up listeners on unmount

---

### Component 5 — Settings: "AI Models" Tab

#### [MODIFY] `src/features/SettingsDialog/SettingsDialog.tsx`
Add a new `"ai-models"` tab (using `Bot` icon, already imported):
```ts
{ id: "ai-models", name: "AI Models", icon: Bot, desc: "Configure LLM providers and manage local models" }
```

#### [NEW] `src/features/SettingsDialog/AiModelSetting.tsx`
Two-section settings page modeled after `EmbeddingModelSetting.tsx`:

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
Add `<AiChatButton />` next to the terminal toggle button (right section, before settings).

#### [MODIFY] `src/features/Titlebar/WindowsTitlebar.tsx`
Same as above.

---

### Component 7 — Root Layout

#### [MODIFY] `src/App.tsx`
Render `<AiChatPanel />` at the root level (outside router, persistent overlay), controlled by `isChatOpenAtom`.

---

## File Map

| File | Change |
|------|--------|
| `src-tauri/Cargo.toml` | Add `llama-cpp-2`, `scraper` |
| `src-tauri/src/commands/mod.rs` | Add `pub mod llm` |
| `src-tauri/src/commands/llm.rs` | **NEW** — full LLM backend (providers + tools + persistence) |
| `src-tauri/src/lib.rs` | Register `LlmState` + all llm commands |
| `src/api-client/llm.ts` | **NEW** — Tauri `invoke`/`listen` wrappers |
| `src/stores/AiChatStore.ts` | **NEW** — Jotai atoms (UI, sessions, provider, models) |
| `src/features/AiChat/AiChatButton.tsx` | **NEW** — Titlebar icon |
| `src/features/AiChat/AiChatPanel.tsx` | **NEW** — Floating chatbox with session sidebar |
| `src/features/AiChat/AiChatMessage.tsx` | **NEW** — Message bubble |
| `src/features/AiChat/AiChatToolCall.tsx` | **NEW** — Collapsible tool call display |
| `src/features/AiChat/useLlmStream.ts` | **NEW** — Token streaming lifecycle hook |
| `src/features/SettingsDialog/AiModelSetting.tsx` | **NEW** — Provider config + GGUF model manager |
| `src/features/SettingsDialog/SettingsDialog.tsx` | Add "AI Models" tab |
| `src/features/Titlebar/MacOSTitlebar.tsx` | Add `<AiChatButton />` |
| `src/features/Titlebar/WindowsTitlebar.tsx` | Add `<AiChatButton />` |
| `src/App.tsx` | Mount `<AiChatPanel />` globally |

---

## Implementation Order

1. **Rust backend** (`llm.rs`) — provider trait + local GGUF + remote HTTP + tool executor
2. **Cargo.toml** — add `llama-cpp-2`, verify Metal build on macOS
3. **`lib.rs`** — register state + handlers
4. **`src/api-client/llm.ts`** — Tauri wrappers
5. **`src/stores/AiChatStore.ts`** — atoms
6. **`AiModelSetting.tsx`** — settings UI + model downloader
7. **`SettingsDialog.tsx`** — add AI Models tab
8. **`AiChat/*`** — panel, messages, tool call, stream hook
9. **Titlebars** — add chat button
10. **`App.tsx`** — mount panel

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
| Switch to Local, select model, Save | ✅ Model loads in Rust |
| Send a message → streaming response | ✅ Tokens appear live |
| LLM triggers `read_file` tool | ✅ Tool block shown in chat bubble |
| LLM triggers `run_shell` tool | ✅ Shell output shown; rejected if outside workspace |
| LLM triggers `web_search` tool | ✅ DuckDuckGo results shown, no API key prompt |
| Configure Ollama endpoint + send | ✅ Response streams from local Ollama |
| Configure LM Studio endpoint + send | ✅ Response streams from LM Studio |
| Configure OpenAI key + send | ✅ GPT-4o streams |
| Configure Claude key + send | ✅ Claude streams |
| Restart app, reopen chat | ✅ Past sessions listed; clicking one loads history |
| `.depdok/chat/<id>/history.json` exists | ✅ File created after first message sent |
