AGENTS.md — Repo agent guidance

## Project Overview
This is a template for building cross-platform desktop applications using Tauri, React, and TypeScript. The template comes pre-configured with essential tools, UI components, and backend commands for file system and Git operations.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: shadcn/ui (pre-configured)
- **Styling**: Tailwind CSS v4
- **State Management**: Jotai
- **Routing**: React Router v7
- **Backend**: Tauri v2 + Rust
- **Build Tool**: Vite

## Code Structure
```
src/                    # Frontend React application
├── components/         # Reusable UI components (shadcn/ui)
├── features/           # Feature-specific components
├── pages/              # Page components for routing
├── stores/             # Jotai state management stores
├── hooks/              # Custom React hooks
├── lib/                # Utility functions and helpers
├── App.tsx             # Main application component
└── main.tsx            # Application entry point

src-tauri/              # Tauri backend (Rust)
├── src/
│   ├── commands/       # Tauri command modules
│   │   ├── files.rs    # File system operations
│   │   └── git.rs      # Git operations
│   ├── lib.rs          # Main library file
│   └── main.rs         # Application entry point
├── Cargo.toml          # Rust dependencies
└── tauri.conf.json     # Tauri configuration
```

## Rules
- Do not run `git add` command

## Built-in Tauri Commands

### File System Commands (files.rs)
- `list_dir(path: string)` - List directory contents
- `read_file_content(path: string)` - Read file content
- `write_file_content(path: string, content: string)` - Write to file
- `create_directory(path: string)` - Create directory
- `create_file(path: string)` - Create file
- `delete_node(path: string)` - Delete file/directory
- `rename_node(old_path: string, new_path: string)` - Rename/move file/directory

### Git Commands (git.rs)
- `get_current_branch(working_dir: string)` - Get current branch
- `get_all_branches(working_dir: string)` - List all branches
- `switch_branch(working_dir: string, branch: string)` - Switch branch
- `get_git_status(working_dir: string)` - Get file status (modified, added, etc.)
- `git_pull(working_dir: string)` - Pull from remote

## Build / dev / app commands
- Run dev UI: `pnpm dev` (runs `vite`).
- Build web: `pnpm build` (runs `tsc && vite build`).
- Preview build: `pnpm preview`.
- Tauri app dev: `pnpm app-dev`.
- Tauri app build: `pnpm app-build`.

## Tests & lint
- This repo has no test runner or linter configured by default.
- Recommended single-test workflow (Vitest): `pnpm add -D vitest @testing-library/react` then `pnpm vitest -t "Your test name"` to run a single test by name.
- Recommended lint command (ESLint): `pnpm add -D eslint` then `pnpm eslint "src/**/*.{ts,tsx}" --fix`.

## Code style (agents must follow)
- Imports: group and order imports as: external packages → UI/lib → features/stores → relative imports; keep them sorted within groups.
- Formatting: use Prettier (or `prettier --write`) and TypeScript formatting rules; keep 2-space indent.
- Types: prefer explicit return types for exported functions/components; avoid `any` — use `unknown` and narrow instead.
- React components: `PascalCase` filenames and component names (e.g. `MyComponent.tsx`).
- Other files/variables: `camelCase` for functions/vars, `UPPER_SNAKE` for constants.
- Exports: prefer named exports; avoid default exports for shared modules.
- Error handling: do not swallow errors; log with `console.error` and return meaningful error objects or throw with context.
- Side effects: keep components pure where possible; push side effects to hooks or stores (`stores/`).

## UI Components
This template uses shadcn/ui with Tailwind CSS. Pre-configured components include:
- Context Menu, Dialog, Dropdown Menu
- Popover, Progress, Switch
- Toast, Tooltip
- Command (cmdk)

When adding new shadcn/ui components, use: `pnpm dlx shadcn@latest add [component-name]`

## State Management
- Use Jotai for global state management
- Store files should be placed in `src/stores/`
- Follow atomic state patterns
- Keep stores focused and composable

## Routing
- React Router v7 is configured for client-side routing
- Page components should be placed in `src/pages/`
- Use React Router's data loading patterns where applicable

## Knowledge Base, Embedding Models, & MCP
This repository includes a semantic knowledge base, support for local & remote embedding models, a Model Context Protocol (MCP) server, and native GGUF/API chat integration:
- **Knowledge Base & Semantic Search**: Uses `sqlite-vec` in the Rust backend for vector embeddings and KNN search, with Markdown split at the section/heading level. Documentation on schema, query flows, and reindexing is at [docs/knowledge-base/knowledge-base.md](file:///Users/hudy/ws/depdok/docs/knowledge-base/knowledge-base.md).
- **Dynamic Embedding Models**: Supports offline local models (e.g., E5 multilingual, BGE Chinese/English, nomic-embed) and online remote models (OpenAI). Switching models triggers a vector database wipe and re-indexing. Details are in [docs/knowledge-base/knowledge-base.md](file:///Users/hudy/ws/depdok/docs/knowledge-base/knowledge-base.md#dynamic-embedding-models).
- **Depdok MCP Server**: Exposes tools for other AI agents to interact with the workspace and the knowledge base. Run configurations, setup, and tools documentation is at [docs/knowledge-base/mcp-agent-guide.md](file:///Users/hudy/ws/depdok/docs/knowledge-base/mcp-agent-guide.md).
- **LLM & Native AI Chat Integration**: Implements local GGUF models (`llama.cpp`), remote API clients, global state coordination, recursive agentic tool calls, and UI chat panel. Complete architecture and guide is at [docs/llm-integration.md](file:///Users/hudy/ws/depdok/docs/llm-integration.md).

## Markdown Comments & Tiptap Extension
Depdok supports inline Markdown comments using custom Tiptap mark extensions and invisible HTML comment blocks:
- **Markdown Comments Architecture & Guide**: Details on inline `<span data-comment-id>` anchor marks, invisible JSON comment thread blocks (`<!-- DEPDOK_COMMENT_<id>: {...} -->`), co-located modules in `src/features/PreviewMarkdown/extensions/comment/`, bottom menu controls, and sidebar drawer components are documented in [docs/markdown-comments.md](file:///Users/hudy/ws/depdok/docs/markdown-comments.md).

## Markdown Pagination & Word-Like Page Layout
Depdok supports a Microsoft Word-like paginated view mode using a custom, open-source ProseMirror decoration plugin:
- **Markdown Pagination Architecture & Guide**: Details on the decoration-based plugin (`PaginationExtension`), A4 sheet calculation, page break spacers, adjacent sibling top-margin rules (`.page-break-spacer + *`), gray canvas backdrop, page size modes (`"page"`), and zero-recreation runtime toggling are documented in [docs/markdown-pagination.md](file:///Users/hudy/ws/depdok/docs/markdown-pagination.md).

## Tooling rules
- Cursor / Copilot rules: no `.cursor` or `.cursorrules` and no `.github/copilot-instructions.md` were found in repo — none to enforce.

## Scope
- This file applies to the entire repository. Follow these rules when making edits, running commands, or authoring changes.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **depdok** (5345 symbols, 9632 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/depdok/context` | Codebase overview, check index freshness |
| `gitnexus://repo/depdok/clusters` | All functional areas |
| `gitnexus://repo/depdok/processes` | All execution flows |
| `gitnexus://repo/depdok/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
