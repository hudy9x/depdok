# LLM v2 Subsystem: Architecture, Tooling & Dual-Model Engine

The **LLM v2 subsystem** in Depdok provides an agentic AI assistant capable of multi-turn conversation, real-time token streaming, multi-tool calling across the frontend workspace, and dual-model specialization.

---

## 1. System Architecture Diagram

```
                                  ┌─────────────────────────────────────────┐
                                  │          React Desktop UI               │
                                  │  • LLMChat2Panel (Floating drawer)      │
                                  │  • FileMentionPopup (@ fuzzy search)    │
                                  │  • ToolCallCard (Inline tool inspector) │
                                  │  • useToolListener (IPC event bridge)   │
                                  └────────────────────┬────────────────────┘
                                                       │
                           Tauri IPC ("llm2_send_message")  ▲  "llm2_token" (Streaming)
                                                       │    │  "tool_log_event" (Live UI Sync)
                                                       ▼    │
                                  ┌─────────────────────────────────────────┐
                                  │           Rust Backend (llm2)           │
                                  │  • agent.rs (Multi-turn loop & prompts) │
                                  │  • tools.rs (PortableTool declarations) │
                                  │  • pending.rs (Oneshot channel bridge)  │
                                  │  • commands.rs (Tauri IPC endpoints)    │
                                  └────────────────────┬────────────────────┘
                                                       │
                         ┌─────────────────────────────┴─────────────────────────────┐
                         │                                                           │
                         ▼                                                           ▼
         ┌───────────────────────────────┐                           ┌───────────────────────────────┐
         │     Ollama Local Server       │                           │      Ollama Local Server      │
         │   ⚙️ Tool Specialist Model    │                           │   ✍️ Content Specialist Model │
         │         (qwen2.5:7b)          │                           │          (gemma2:9b)          │
         │                               │                           │                               │
         │ • Fast JSON tool extraction   │                           │ • Deep Markdown prose & blogs │
         │ • Multi-tool orchestration    │                           │ • Comprehensive tutorials     │
         │ • Workspace action routing    │                           │ • Direct backend execution    │
         └───────────────────────────────┘                           └───────────────────────────────┘
```

---

## 2. Directory Structure

```
src/features/LLMChat2/                  # ⚛️ Frontend React & Tools
├── components/
│   ├── LLMChat2Panel.tsx               # Main chat panel with streaming UI and header inputs
│   ├── FileMentionPopup.tsx            # Autocomplete popup triggered by typing '@'
│   └── ToolCallCard.tsx                # Collapsible inline tool cards inside chat bubbles
├── hooks/
│   └── useToolListener.ts              # IPC listener for 'tool_request' and 'tool_log_event'
├── store/
│   └── LLMChat2Store.ts                # Jotai atoms for messages, active logs, model settings
└── tools/                              # Organized tool packages
    ├── common/
    │   └── pathHelper.ts               # Path normalization and active doc resolver
    ├── markdown/
    │   ├── readMarkdown.ts             # Reads file or active tab, extracts headings & comments
    │   ├── upsertMarkdown.ts           # Overwrites or creates markdown files
    │   ├── upsertMarkdownSection.ts    # Surgical section replacement or auto-append
    │   └── addMarkdownComment.ts       # Adds inline review comment thread to markdown
    ├── fileSystem/
    │   ├── createFile.ts               # Creates file with initial templates
    │   ├── createFolder.ts             # Creates new directory
    │   ├── renameFile.ts               # Renames file & updates open editor tabs
    │   ├── renameFolder.ts             # Renames folder & updates open editor tabs
    │   └── deleteFileOrFolder.ts       # Deletes file or folder & closes tabs
    ├── database/
    │   ├── getUserName.ts              # Database user lookup by ID
    │   ├── getUserAge.ts               # User age by name
    │   ├── getUserCountry.ts           # User country by name
    │   └── getUserDob.ts               # User date of birth by name
    └── math/
        └── sumFourDigits.ts            # Four-digit arithmetic sum

src-tauri/src/llm2/                     # 🦀 Rust Backend Orchestrator
├── mod.rs                              # Subsystem module root
├── agent.rs                            # Multi-turn resolution loop, streaming engine & prompt
├── tools.rs                            # PortableTool traits, timeout safeguards & backend tools
├── pending.rs                          # Thread-safe Oneshot channel registry
└── commands.rs                         # Tauri IPC commands (llm2_send_message, llm2_tool_result)
```

---

## 3. Tool Suites Reference

### A. Markdown Operations Suite

| Tool Name | Parameters | Behavior |
|---|---|---|
| `read_markdown` | `{ path?: string }` | Reads full file or currently active document. Returns text, headings outline (`# H1, ## H2`), word count, and inline comments. |
| `upsert_markdown` | `{ path?: string, content: string }` | Overwrites existing markdown or creates new file on disk. Refreshes the explorer tree. |
| `upsert_markdown_section` | `{ path?: string, heading?: string, target_text?: string, replacement_content: string }` | If `heading` exists, replaces that section. If missing, cleanly appends section before bottom comment blocks. |
| `add_markdown_comment` | `{ path?: string, target_text: string, comment: string, author?: string }` | Wraps `target_text` with comment anchor and inserts metadata thread into the document. |

### B. File System Operations Suite

| Tool Name | Parameters | Behavior |
|---|---|---|
| `create_file` | `{ path: string, content?: string }` | Creates new file with initial content or default template (e.g. `.excalidraw`, `.xlsx`), refreshes explorer. |
| `create_folder` | `{ path: string }` | Creates a new directory at the specified path. |
| `rename_file` | `{ old_path: string, new_name: string }` | Renames file, automatically syncs open tab titles and active file references. |
| `rename_folder` | `{ old_path: string, new_name: string }` | Renames directory and updates paths of any open child document tabs. |
| `delete_file_or_folder` | `{ path: string }` | Deletes file or directory and automatically closes associated editor tabs. |

### C. Content Generation (Secondary Model)

| Tool Name | Parameters | Behavior |
|---|---|---|
| `generate_content` | `{ topic: string, style?: string, language?: string, content_model?: string }` | Directly invokes **`gemma2:9b`** in the Rust backend to generate rich, creative, or long-form prose with a 180s timeout. |

---

## 4. Real-Time Token Streaming & UI Synchronization

1. **Chunk-by-Chunk Token Streaming**:
   - The Rust backend sends HTTP requests with `"stream": true` to Ollama.
   - For every text delta received, Rust emits an `llm2_token` event containing `{ message_id, chunk }`.
   - The React frontend appends deltas live to the active assistant chat bubble.
2. **Inline Tool Execution Cards (`ToolCallCard.tsx`)**:
   - As tools are executed, `ToolExecutionLog` entries are attached directly to the assistant message in `chat2MessagesAtom`.
   - The UI renders collapsible cards displaying tool name, live badge (`Executing` ➔ `Done`), parameter inspector, and formatted JSON output.
3. **`@` File Mentioning (`FileMentionPopup.tsx`)**:
   - Typing `@` in the chat input opens an instant fuzzy-search popup populated by `FileSearchDialog/api.ts`.
   - Selecting a file inserts `@filename.md` into the input box, allowing the LLM to target exact workspace files.

---

## 5. Backend Structured Debug Logging

The backend automatically logs all payloads sent to and received from Ollama in the terminal:

```text
════════════════════ [llm2][turn 0] REQUEST TO OLLAMA ════════════════════
Model: qwen2.5:7b
Payload: { ... }
────────────────────────────────────────────────────────────────────────────

════════════════════ [llm2][turn 0] RESPONSE FROM OLLAMA ════════════════════
Text delta (len 0): <empty>
Tool Calls (count 1): [ { "function": { "name": "read_markdown", ... } } ]
────────────────────────────────────────────────────────────────────────────

════════════════════ [llm2][content_model] REQUEST TO OLLAMA ════════════════════
Model: gemma2:9b
Payload: { "model": "gemma2:9b", "messages": [ ... ] }
────────────────────────────────────────────────────────────────────────────

════════════════════ [llm2][content_model] RESPONSE FROM OLLAMA ════════════════════
Generated prose (len 1840):
# Overview of Project Architecture ...
────────────────────────────────────────────────────────────────────────────
```
