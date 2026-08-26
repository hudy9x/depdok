# How Skills Work in Depdok

This document explains the runtime lifecycle, per-turn system prompt injection, tool filtering, and multi-skill composition in Depdok.

---

## 1. High-Level Concept & Lifecycle

A **Skill** in Depdok is a project-local Markdown file (`.depdok/skills/<name>.md`) that defines:
1. **Metadata & Allowed Tools** (YAML frontmatter)
2. **Instructions & Persona** (Markdown body)

Skills are **ephemeral and turn-scoped**: they are injected into the system prompt **only when explicitly tagged** with `/<skill-name>` in the prompt, and cleared after each turn.

```
 User Types Input              Frontend Resolution              Rust Orchestrator (Rig)          Ollama Inference
┌────────────────────────┐    ┌─────────────────────────┐    ┌─────────────────────────┐    ┌────────────────────────┐
│ /kb /reviewer          │    │ 1. Parse /skill tags    │    │ 1. Assemble dynamic     │    │ Turn 0:                │
│ "Review @overview.md"  │───>│ 2. Combine bodies       │───>│    System Prompt        │───>│ Model receives scoped  │
│                        │    │ 3. Union allowed tools  │    │ 2. Filter tool schema   │    │ prompt & allowed tools │
└────────────────────────┘    └─────────────────────────┘    └─────────────────────────┘    └────────────────────────┘
          │                                                                                             │
          │ [Enter Pressed]                                                                             │
          ▼                                                                                             ▼
┌────────────────────────┐                                                                  ┌────────────────────────┐
│ Input & tags cleared.  │                                                                  │ Streamed response with │
│ Next message is clean! │                                                                  │ tool execution results │
└────────────────────────┘                                                                  └────────────────────────┘
```

---

## 2. Skill File Anatomy

Each skill file is structured into two distinct parts:

```
.depdok/skills/meeting-summarizer.md
┌────────────────────────────────────────────────────────┐
│ ---                                                    │ <─── FRONTMATTER (Parsed on load)
│ name: meeting-summarizer                               │      - Unique identifier
│ description: Extract action items and decisions        │      - Shown in '/' menu
│ tools:                                                 │      - Restricts callable tools
│   - read_markdown                                      │
│   - upsert_markdown_section                            │
│ ---                                                    │
│ You are an expert meeting note-taker.                  │ <─── BODY (Injected into System Prompt)
│                                                        │      - Role / Persona instructions
│ 1. Read document via `read_markdown`.                  │      - Step-by-step workflow
│ 2. Extract Key Decisions and Action Items.             │      - Output constraints & format
│ 3. Update note via `upsert_markdown_section`.          │
└────────────────────────────────────────────────────────┘
```

---

## 3. Dynamic Per-Turn System Prompt Injection

> **Important**: The base system prompt is **stateless**. When you type `/skill-name`, its Markdown body is appended to the system prompt **only for that specific request**.

```
Base System Prompt (qwen2.5:7b dual-model rules, general tool guidelines)
                             │
                             ▼
              [ User tagged /meeting-summarizer ]
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────────┐
│ SYSTEM PROMPT (Sent to Ollama for this turn)                           │
│                                                                        │
│ You are a helpful AI desktop assistant for Depdok... (Base rules)     │
│                                                                        │
│ ---                                                                    │
│ ## Active Skill Instructions                                           │
│ ### Active Skill: /meeting-summarizer                                  │
│ You are an expert meeting note-taker.                                  │
│ 1. Read document via `read_markdown`...                                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Multi-Skill Composition

You can tag **multiple skills** in the same prompt (e.g. `/kb /meeting-summarizer @notes.md`). 
Depdok resolves multiple skills by:
1. **Concatenating system prompts** in order.
2. **Merging allowed tools** as a union set.

```
User Prompt: "/kb /meeting-summarizer summarize @notes.md"
                    │
       ┌────────────┴────────────┐
       ▼                         ▼
  Skill 1: /kb             Skill 2: /meeting-summarizer
  - Tools: [search_kb]     - Tools: [read_md, upsert_md_section]
  - Body: KB search rules  - Body: Summarizer formatting
       │                         │
       └────────────┬────────────┘
                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Combined System Prompt:                                                │
│   Base Instructions                                                    │
│   + Skill 1 Body (/kb)                                                 │
│   + Skill 2 Body (/meeting-summarizer)                                 │
│                                                                        │
│ Filtered Tool Schema:                                                  │
│   [search_knowledge_base, read_markdown, upsert_markdown_section]      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Tool Scoping & Sandboxing

When a skill is active, the assistant is restricted to **only the tools declared in that skill**:

```
Available App Tools: [read_markdown, upsert_markdown, delete_file, list_files, move_files, search_kb, ...]
                                               │
                                               ▼
                              Skill declared tools: [read_markdown]
                                               │
                                               ▼
                          Filtered Schema sent to Ollama:
                          ┌────────────────────────┐
                          │ - read_markdown        │
                          └────────────────────────┘
                          (All other tools blocked for this turn)
```

* If a skill specifies `tools: []` (or omits `tools`), Ollama receives an empty tool list, enforcing **pure conversational guidance without tool calling**.
* If **no skills** are tagged in the prompt, all registered native tools remain available by default.

---

## 6. Execution Step-by-Step

```
Step 1: User types "/" in LLM Chat input
        └── Floating menu displays available commands (/skill-setup, /skill-reload) and project skills.

Step 2: User selects a skill
        └── Inline token "/<skill-name> " is inserted into the textarea.

Step 3: User hits Enter to send prompt
        ├── Frontend extracts all "/<skill-name>" tokens.
        ├── Resolves matched Skill objects from local cache.
        ├── Combines bodies -> `system_prompt_addendum`.
        ├── Combines tools  -> `allowed_tools`.
        ├── Input field is immediately cleared for the next prompt.
        └── Backend dispatches scoped turn to Ollama.

Step 4: Ollama processes prompt & calls allowed tools
        ├── Executes tool requests via React frontend bridge.
        └── Streams final synthesized markdown back to chat.
```
