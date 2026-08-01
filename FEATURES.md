# Depdok — Main Features

Depdok is a local-first desktop application for developer documentation. It combines a Markdown workspace, diagram-aware editing, project search, a local semantic knowledge base, and AI assistance in a Tauri application for macOS and Windows.

## Documentation authoring

- **Markdown code and rich-preview modes.** Write raw Markdown in Monaco or edit its rendered TipTap/ProseMirror representation, with autosave, draft recovery, side-by-side viewing, and scroll synchronization.
- **Workspace-oriented editing.** Open local folders; work with tabs, multi-pane splits, breadcrumbs, and persistent recent-project state. Multiple application windows keep independent active sessions while remembering each project's tabs and expanded folders.
- **Rich Markdown tools.** Includes syntax-highlighted code blocks, headings and an outline/minimap, links, task lists, image handling, drag handles, inline formatting, and advanced tables (resize, merge/split, and cell colours).
- **Word-style page layout.** A visual A4 pagination mode provides page breaks, paper cards, page numbers, and light/dark canvas styling without changing the Markdown document model.
- **Inline review comments.** Select text to add comment threads and replies, resolve them, and navigate between highlighted text and the comments drawer. Comment data remains portable: anchors are inline HTML spans and thread metadata is stored in invisible HTML comments at the end of the Markdown file.
- **Export.** Export Markdown documents as HTML or PDF from the desktop application.

## Diagrams and specialized document views

- **Mermaid diagrams.** Render Mermaid content directly in documentation, including interactive sequence-diagram navigation between diagram elements and source.
- **PlantUML.** Render PlantUML with native or browser-based preview paths and configurable server/theme settings.
- **Excalidraw previews.** Open and edit drawing content through an integrated Excalidraw view.
- **Image previews.** View local images with zoom controls.
- **`.todo` documents.** Turn a human-readable, Markdown/YAML task format into interactive Kanban or weekly-plan views, with metadata for sections, assignees, priority, tags, and due dates.

## Files, search, and developer workflow

- **File explorer.** Browse a local workspace; create, rename, copy, move, delete, and reveal files or folders through native Tauri commands.
- **Fast navigation.** Search file names with an indexed fuzzy matcher and search file contents across the workspace while respecting Git ignore rules.
- **External-change awareness.** Watch files and workspace folders so the interface can react to edits made outside Depdok.
- **Git essentials.** Detect repositories, view status, list and switch branches, create branches, check upstream/sync state, and pull changes.
- **Integrated terminal.** Run shell sessions in tabbed PTYs inside the application, including input, streamed output, resize support, and cleanup when a terminal closes.
- **CLI support.** Install or remove a `depdok` command that opens folders or files from a terminal; the desktop application also handles forwarded paths from a second launch.

## Local knowledge base and semantic discovery

- **Local vector knowledge base.** Markdown is split by heading/section, embedded by the Rust backend, and stored in SQLite with `sqlite-vec`.
- **Semantic and hybrid search.** Find relevant content by meaning or combined retrieval, then open the originating file; results can resolve at section granularity while preserving the source-file workflow.
- **Project relationships.** Maintain document groups and directed connections, inspect the resulting project graph, and render it in the knowledge-graph view.
- **Configurable embedding models.** Use downloaded local embedding models by default or a remote OpenAI embedding provider. Changing the active model safely rebuilds the vector index.

## AI assistance

- **Native chat panel.** Chat with an assistant using local GGUF models via `llama.cpp` or remote OpenAI, Claude, Ollama, and LM Studio providers.
- **Streaming, local session history, and model controls.** Responses stream into the panel, can be cancelled, and chat histories are stored in the workspace. The settings UI supports provider configuration plus local model scan, download, deletion, and status.
- **Agent tool use.** The assistant can perform workspace-scoped file operations, run shell commands, and perform web searches when the selected model requests a tool.
- **AI writing menu in the Markdown toolbar.** The magic-wand action is available from the editable Markdown bottom toolbar. It transforms the current text selection, then replaces it with an animated result. Actions include tone adjustment, spelling/grammar correction, extending, reducing, simplifying, adding emoji, completing a sentence, summarizing, and translating text.

## MCP integration

Depdok ships a standalone `depdok-mcp-server` executable for MCP-compatible AI clients. It serves the local knowledge base over standard JSON-RPC stdio using the Model Context Protocol:

- **Knowledge-base tools.** Connected clients can call `kb_get_status` for database statistics, `kb_search` for hybrid keyword-plus-vector search, and `kb_search_similar` for semantic vector search.
- **Local, configurable server.** The binary initializes its own SQLite/vector knowledge-base state and accepts configuration through CLI arguments, environment variables, or a JSON file—covering the database path, embedding-model cache, and server identity.
- **In-app connection support.** Depdok can locate valid installed/development MCP-server binaries and check whether supported AI clients have a Depdok configuration. The settings UI surfaces the available server path for use in a client configuration.

## Appearance, platform, and licensing

- Custom macOS and Windows titlebars, theme selection, Monaco theme selection, and configurable Markdown asset folders.
- macOS-oriented window support includes transparent/vibrant presentation and dock integration; the core Tauri application is also built for Windows.
- Optional licensed-feature protection with activation and management dialogs backed by native keychain storage.

## Technology foundation

The interface uses React, TypeScript, Vite, Tailwind, shadcn/ui, Jotai, Monaco, and TipTap. The native layer uses Tauri and Rust for filesystem access, Git, search, terminal sessions, export, local SQLite/vector storage, local model execution, and MCP serving.
