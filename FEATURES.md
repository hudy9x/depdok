# Depdok — Features

## Overview
Depdok is a local-first desktop application for developer documentation and technical workflows, combining rich Markdown editing, interactive diagramming, semantic knowledge management, and AI assistance.

## Key Features

- **Smart Markdown & Visual Editing**: Dual Monaco code and TipTap WYSIWYG modes with Word-like A4 pagination, inline review comments, advanced tables, and PDF/HTML export.
- **Diagrams & Multi-Format Previews**: Native support for Mermaid, PlantUML, Excalidraw drawings, `.todo` Kanban boards, spreadsheets (`.xlsx`/`.csv`), and images.
- **Developer Workspace & Tools**: Tabbed multi-pane workspace, fast fuzzy and workspace content search, Git status and branch management, integrated PTY terminal, and CLI launcher.
- **Local Knowledge Base**: Local SQLite-vec vector database providing section-level semantic/hybrid search and interactive visual knowledge graphs.
- **Native AI Assistant & MCP**: Chat panel supporting local and cloud LLMs, agent tool calling (files, shell, search), inline AI writing toolbar, and standalone MCP server integration.

## Native AI Assistant Details

### Multi-Provider & Dual-Model Architecture
- **Local & Cloud Models**: Native connectivity for local models via Ollama and GGUF (`llama.cpp`), alongside cloud providers (OpenAI, Anthropic Claude, LM Studio).
- **Dual-Model Engine**: Specializes workloads between fast tool-calling orchestrators (e.g., `qwen2.5:7b`) and deep content/prose generators (e.g., `gemma2:9b`).
- **Real-Time Streaming**: Token streaming with live thinking indicators and instant cancellation.

### Frontend Tool-Calling & Workspace Agency
The Rust orchestrator coordinates multi-turn reasoning and routes tool execution over Tauri IPC to the React frontend:
- **Workspace File Operations**: Read, write, create, delete, and search files across the active directory.
- **Specialized Document Tools**: Granular heading/section manipulation for Markdown and cell/sheet editing for spreadsheets (`.xlsx`/`.csv`).
- **Shell Command Execution**: Cross-platform terminal command execution with streamed stdout/stderr output.
- **Web Search**: Real-time web querying integration.
- **Interactive Tool Inspector**: Inline collapsible cards in the chat UI displaying tool arguments, execution states, and live output logs.

### Context & Workflow Integration
- **`@` File Mentions**: Fuzzy-search workspace files to inject file contents directly into the prompt context.
- **Project Skill System (`.depdok/skills/`)**: Markdown-based custom AI workflows with YAML frontmatter, triggered via `/` slash commands (e.g., `/skill-creator`, `/skill-setup`).
- **Inline AI Writing Toolbar**: Contextual magic-wand menu in the Markdown editor for one-click text transformations (tone adjustment, grammar fix, summarize, extend, translate).
- **Model Context Protocol (MCP)**: Standalone `depdok-mcp-server` allowing external AI agents to query Depdok's local SQLite vector knowledge base.
