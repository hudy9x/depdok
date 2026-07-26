# Interactive Chat Tabs & Local LLM Engine Improvements Report

This report summarizes the modifications and additions made to the **depdok** codebase. The primary focus of these changes is to transition the AI chat experience from a single floating panel to a document-based tabbed interface using `.chat` files, while simultaneously improving the local LLM engine's efficiency, prompt template formatting, path resolution, and debugging capabilities.

---

## Executive Summary

The changes introduce a major UI/UX paradigm shift and multiple backend safety/correctness fixes:
1. **Interactive Chat Tabs (`.chat` files)**: Instead of a global floating panel, users can now create, open, and persist chat sessions directly as tabs in the editor. These `.chat` files store session metadata (model, system instructions, context size) as JSON, while actual chat history is saved to the workspace under `.depdok/chat/<session_id>/history.json`.
2. **Robust Multi-Model Formatting (Chat Templates)**: A new chat template module detects model families (Llama 3, ChatML, Gemma, Phi 3) and applies the correct prompt formatting, preventing token leaks and instruction drift.
3. **Local LLM Engine & Token Fixes**: Fixed a critical bug in `engine.rs` where long prompts containing attached files would prematurely cut off the LLM's output. The engine now guarantees up to `max_tokens` of new generation, performs strict context overflow checks, and decodes with correct positional indices.
4. **Workspace-Aware Path Resolution for Tools**: File system tools now automatically resolve relative paths against the current workspace root, enabling safer and more reliable tool execution by the LLM.
5. **Autoreference of Attached Files**: Users can now type `@[relative/path/to/file]` directly in the prompt text, and the frontend will automatically parse, read, and append the file's contents into the context payload.

---

## File-by-File Analysis

### 1. Tauri Backend (Rust)

#### [MODIFY] [src-tauri/src/lib.rs](file:///Users/hudy/ws/depdok/src-tauri/src/lib.rs)
- Registers the new `save_chat_session` Tauri command, exposing it to the React frontend.

#### [MODIFY] [src-tauri/src/llm/chat/session.rs](file:///Users/hudy/ws/depdok/src-tauri/src/llm/chat/session.rs)
- Implements `save_chat_session` to serialize and save the list of `ChatMessage`s to `.depdok/chat/<session_id>/history.json`. It infers the active model and provider, keeping track of the session's metadata.

#### [NEW] [src-tauri/src/llm/chat_template.rs](file:///Users/hudy/ws/depdok/src-tauri/src/llm/chat_template.rs)
- Introduces template formatting for local models. Includes auto-detection for model families:
  - **Llama 3** (via filename match)
  - **Gemma**
  - **Phi 3**
  - **ChatML** (fallback, used for Qwen, DeepSeek-Coder, etc.)
- Provides formatting helpers for chat history compilation (`build_chat_prompt`) and single completions (`wrap_generate_prompt`).
- Implements `strip_special_tokens` to filter out raw templates and special tokens (e.g. `<|eot_id|>`, `<|im_end|>`) from the generated text output.

#### [MODIFY] [src-tauri/src/llm/engine.rs](file:///Users/hudy/ws/depdok/src-tauri/src/llm/engine.rs)
- **Token Index Fix**: Replaced the loop condition that counted prompt tokens towards `max_tokens`. The engine now tracks `generated` tokens separately, guaranteeing full token generation.
- **Decoding Position Fix**: Corrected token position computation in `LlamaBatch` using `let pos = prompt_tokens + generated;` which maintains sequence integrity for self-attention.
- **Context Overflow Safety**: Added checks to abort generation with a descriptive `CONTEXT_OVERFLOW` error if prompt length exceeds the allocated context size.
- Raised default `ctx_size` to `8192` and default `max_tokens` to `2048`.

#### [MODIFY] [src-tauri/src/llm/mod.rs](file:///Users/hudy/ws/depdok/src-tauri/src/llm/mod.rs)
- Registers the newly added `chat_template` module.

#### [MODIFY] [src-tauri/src/llm/provider.rs](file:///Users/hudy/ws/depdok/src-tauri/src/llm/provider.rs)
- Incremented default configuration constants (`ctx_size = 8192`, `max_tokens = 2048`).
- Updated the default system prompt to contain structured tool calling instructions in `<|tool_call|>tool_name{"arg": "val"}<tool_call|>` format, documenting the available tools.

#### [MODIFY] [src-tauri/src/llm/providers/local.rs](file:///Users/hudy/ws/depdok/src-tauri/src/llm/providers/local.rs)
- Refactored prompt construction to use `chat_template` functions.
- Filters out special tokens at the stream chunk level.
- Refined the tool call parsing regex and logic to tolerate parsing issues and log detailed diagnostics.
- Gracefully emits stream errors to the text stream and triggers `llm-done`.

#### [MODIFY] [src-tauri/src/llm/tools/fs.rs](file:///Users/hudy/ws/depdok/src-tauri/src/llm/tools/fs.rs)
- Added `resolve_path(path, workspace_root)` to map relative paths to the workspace.
- Updated `read_file`, `write_file`, and `list_directory` to use this path resolution.
- Added comprehensive success/failure logging around file writing.

#### [MODIFY] [src-tauri/src/llm/tools/mod.rs](file:///Users/hudy/ws/depdok/src-tauri/src/llm/tools/mod.rs)
- Updates parameter descriptions for `read_file`, `write_file`, and `list_directory` tools to explicitly instruct the model that relative paths are supported.
- Pipes the workspace root path through the tool execution boundary.

---

### 2. Frontend React Application

#### [MODIFY] [src/App.tsx](file:///Users/hudy/ws/depdok/src/App.tsx)
- Removes the `<LLMChatPanel />` from the global viewport, transitioning the application layout to a document-based chat editor paradigm.

#### [MODIFY] [src/components/FileIcon.tsx](file:///Users/hudy/ws/depdok/src/components/FileIcon.tsx)
- Added a specialized `Bot` icon for files ending with the `.chat` extension.

#### [MODIFY] [src/features/EditorTabs/CreateTabButton.tsx](file:///Users/hudy/ws/depdok/src/features/EditorTabs/CreateTabButton.tsx)
- Adds `AI Chat` (`.chat`) to the quick creation dropdown menu and the system dialog filter list.

#### [MODIFY] [src/features/EditorViewMode/index.tsx](file:///Users/hudy/ws/depdok/src/features/EditorViewMode/index.tsx)
- Registers `.chat` (along with `.todo` and `.npuml`) as a `"preview-only"` file type, skipping Monaco text editor loading.

#### [MODIFY] [src/features/LLMChat/api/llm.ts](file:///Users/hudy/ws/depdok/src/features/LLMChat/api/llm.ts)
- Adds `saveChatSession` to invoke the backend Tauri command.

#### [MODIFY] [src/features/LLMChat/components/LLMChatButton.tsx](file:///Users/hudy/ws/depdok/src/features/LLMChat/components/LLMChatButton.tsx)
- Updates clicking the AI Chat header button to generate a random 6-character ID, create an untitled `.chat` tab (e.g. `Untitled-abc123.chat`), and redirect to the `/editor` view.

#### [MODIFY] [src/features/LLMChat/components/LLMChatInput.tsx](file:///Users/hudy/ws/depdok/src/features/LLMChat/components/LLMChatInput.tsx)
- Introduces `chatSessionInputAtom` in Jotai to cache and restore the unsent draft messages of active chat sessions. Switching between multiple tabs will no longer wipe typed input.

#### [MODIFY] [src/features/LLMChat/components/LLMChatPanel.tsx](file:///Users/hudy/ws/depdok/src/features/LLMChat/components/LLMChatPanel.tsx)
- Adjusts floating panel `zIndex` to `1111` to prevent modal/overlay collisions. Passes `sessionId` to input components.

#### [MODIFY] [src/features/LLMChat/hooks/useLlmStream.ts](file:///Users/hudy/ws/depdok/src/features/LLMChat/hooks/useLlmStream.ts)
- Improves token generation debugging logs.
- Employs a more robust, quote-tolerant regex for parsing `[FILE: path]` blocks.
- Triggers automatic session saving via `saveChatSession` when a chat finishes generating or encounters an error.

#### [MODIFY] [src/features/LLMChat/lib/promptBuilder.ts](file:///Users/hudy/ws/depdok/src/features/LLMChat/lib/promptBuilder.ts)
- Adds regex-based detection of `@[file]` references inside user prompt messages. Auto-resolves these tags and appends file contents dynamically.

#### [MODIFY] [src/features/LLMChat/settings/LLMModelSetting.tsx](file:///Users/hudy/ws/depdok/src/features/LLMChat/settings/LLMModelSetting.tsx)
- Tracks global context size adjustments in state, setting defaults based on model recommendations.
- Passes context size options down to provider controls.

#### [MODIFY] [src/features/LLMChat/settings/LocalProviderSettings.tsx](file:///Users/hudy/ws/depdok/src/features/LLMChat/settings/LocalProviderSettings.tsx)
- Renders context size selector buttons (4k, 8k, 16k, 32k) and calculates estimated RAM overhead.

#### [MODIFY] [src/features/LLMChat/store/LLMChatStore.ts](file:///Users/hudy/ws/depdok/src/features/LLMChat/store/LLMChatStore.ts)
- Registers the new `chatSessionInputAtom` store for preserving draft state per session.

#### [MODIFY] [src/features/Preview/PreviewPanel.tsx](file:///Users/hudy/ws/depdok/src/features/Preview/PreviewPanel.tsx)
- Renders `<ChatPreview />` when the active tab extension is `chat`.

#### [NEW] [src/features/PreviewChat/ChatDocument.ts](file:///Users/hudy/ws/depdok/src/features/PreviewChat/ChatDocument.ts)
- Declares the structure of `.chat` metadata (`ChatFileMetadata`).
- Implements `parseChatFileMetadata` and `serializeChatFileMetadata` to read/write JSON config headers.

#### [NEW] [src/features/PreviewChat/ChatInlineSettings.tsx](file:///Users/hudy/ws/depdok/src/features/PreviewChat/ChatInlineSettings.tsx)
- Implements an inline options drawer inside the chat tab header, allowing users to override the model, context size, and system prompt parameters for that specific session.

#### [NEW] [src/features/PreviewChat/ChatPreview.tsx](file:///Users/hudy/ws/depdok/src/features/PreviewChat/ChatPreview.tsx)
- Assembles the UI layout for the interactive chat tab. Renders messages, header status labels, inline settings drawer, and chat input.

#### [NEW] [src/features/PreviewChat/index.ts](file:///Users/hudy/ws/depdok/src/features/PreviewChat/index.ts)
- Exposes `ChatPreview` and metadata functions.

#### [NEW] [src/features/PreviewChat/useChatDocument.ts](file:///Users/hudy/ws/depdok/src/features/PreviewChat/useChatDocument.ts)
- React hook that manages `.chat` document lifecycle: parsing, initializing sessions, subscribing to Tauri streaming events, handling pending tool invocations, updating the file configuration, and saving sessions back to `.depdok`.

#### [MODIFY] [src/lib/fileSupport.ts](file:///Users/hudy/ws/depdok/src/lib/fileSupport.ts)
- Appends `chat` to the list of `CUSTOM_PREVIEW_EXTENSIONS`.

---

## Detailed Feature Explanations

### 1. Document-Based Chat Model (Tabbed AI Chat)
Instead of relying on a single, global chat state, Depdok users can manage multiple simultaneous AI conversations by creating `.chat` files. 
- A `.chat` file is a plain JSON document on disk containing configuration metadata for the conversation:
  ```json
  {
    "version": 1,
    "session_id": "abc123xyz",
    "ctx_size": 8192,
    "model": "/absolute/path/to/model.gguf",
    "system_prompt": "You are a specialized coding agent."
  }
  ```
- The actual chat log is stored separately in the workspace dotfiles (`.depdok/chat/<session_id>/history.json`) to keep the working `.chat` file extremely light and clean.

### 2. Multi-Model Chat Templates
Local LLM models expect specific header tokens (BOS, EOS, role tags) to separate System, User, and Assistant turns. If standard strings are used, models often fail to identify boundaries and hallucinate user inputs or print empty spaces. The `chat_template` module resolves this by mapping standard API messages to structural formats:
- **Llama 3**: `<|start_header_id|>user<|end_header_id|>\n\n{content}<|eot_id|>`
- **ChatML**: `<|im_start|>user\n{content}<|im_end|>\n`
- **Gemma**: `<start_of_turn>user\n{content}<end_of_turn>\n`
- **Phi 3**: `<|user|>\n{content}<|end|>\n`

### 3. Context Size Customization
Higher context windows consume more memory. The changes introduce custom limits, allowing users to scale context length (from 4k to 32k) and showing the corresponding RAM estimates (ranging from ~250MB to ~2.0GB KV-cache overhead).
In addition, `engine.rs` now protects the server against memory bounds by throwing a clear context overflow notification when the prompt sequence exceeds the selected token limit.

### 4. Smart Workspace Path Handling
LLMs often struggle with absolute paths when workspace structures vary. By using relative-to-workspace resolution, the model can safely run tools on paths like `src/lib.rs` instead of requiring absolute forms (e.g. `/Users/hudy/ws/depdok/src/lib.rs`), significantly reducing file write and lookup failures.
