# Connecting an AI Agent to Depdok via MCP

Depdok ships a standalone **MCP (Model Context Protocol) server** that exposes its knowledge-base to any MCP-compatible AI agent (Claude Desktop, Cursor, Continue, etc.).

---

## Quick start

If you are new to MCP, there are 2 different configurations:

- AI client configuration: tells Claude/Cursor/Continue how to launch `depdok-mcp-server`.
- Depdok server configuration (optional): runtime options for Depdok itself (`db path`, `cache`, `write mode`, etc.).

### 1. Locate the binary

After building Depdok, the MCP server binary is compiled as a separate executable:

```
# macOS (after `pnpm app-build`)
src-tauri/target/release/depdok-mcp-server
```

### 2. Register it in your agent

### Where is the AI client config file?

On macOS, Claude Desktop reads:

```text
~/Library/Application Support/Claude/claude_desktop_config.json
```

If the file does not exist yet, create it.

#### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "depdok": {
      "command": "/path/to/depdok-mcp-server",
      "args": ["--write-enabled"]
    }
  }
}
```

> Omit `--write-enabled` (or pass `--read-only`) to restrict the agent to read-only access.

Minimal read-only example:

```json
{
  "mcpServers": {
    "depdok": {
      "command": "/absolute/path/to/depdok-mcp-server",
      "args": ["--read-only"]
    }
  }
}
```

#### Cursor / Continue / other MCP clients

Point the client at the binary using its standard `stdio` transport configuration. The exact config location/format differs by client version, so use the MCP settings page in the client UI and set:

- command: absolute path to `depdok-mcp-server`
- args: `--read-only` or `--write-enabled`

---

## Configuration

The server can be configured via **CLI flags**, **environment variables**, or a **JSON config file**.

| CLI flag | Env variable | Default | Description |
|---|---|---|---|
| `--config <path>` | `DEPDOK_MCP_CONFIG` | — | Path to a JSON config file |
| `--db-path <path>` | `DEPDOK_MCP_DB_PATH` | `~/.local/share/depdok/knowledge_base.db` | SQLite database path |
| `--cache-dir <path>` | `DEPDOK_MCP_CACHE_DIR` | `~/.local/share/depdok/cache` | Embedding model cache directory |
| `--default-group-id <id>` | `DEPDOK_MCP_DEFAULT_GROUP_ID` | `default` | Project group used when `groupId` is omitted |
| `--write-enabled` | `DEPDOK_MCP_WRITE_ENABLED=true` | `false` | Enable write tools |
| `--read-only` | `DEPDOK_MCP_WRITE_ENABLED=false` | — | Force read-only mode |
| `--protocol-version` | `DEPDOK_MCP_PROTOCOL_VERSION` | `2024-11-05` | MCP protocol version to advertise |

### JSON config file example

```json
{
  "database_path": "/Users/me/Documents/depdok/kb.db",
  "cache_dir": "/Users/me/.cache/depdok",
  "write_enabled": true,
  "default_group_id": "my-project"
}
```

Pass it with: `depdok-mcp-server --config /path/to/config.json`

### Where is Depdok server config stored?

There is no forced default config file path. You choose it.

Common pattern on macOS:

```text
~/.config/depdok/mcp.json
```

Then either:

- pass it directly in your client args: `--config /Users/<you>/.config/depdok/mcp.json`
- or set env var: `DEPDOK_MCP_CONFIG=/Users/<you>/.config/depdok/mcp.json`

If you do neither, Depdok MCP uses built-in defaults.

### What defaults are used if no config is provided?

- `write_enabled`: `false` (read-only)
- `default_group_id`: `default`
- `protocol_version`: `2024-11-05`
- `database_path`: Depdok data directory + `knowledge_base.db`
- `cache_dir`: Depdok data directory + `cache`

On macOS, the data directory resolves from your home directory at runtime.

---

## Exposed MCP tools

### Read-only tools (always available)

#### `kb_get_status`
Returns SQLite version, database path, and record counts.

```json
// No input required
{}
```

---

#### `kb_search_similar`
Semantic search — finds documents similar to a natural-language query.

```json
{
  "query": "authentication flow",   // required
  "limit": 10                        // optional, default 10
}
```

Returns a ranked list of matching document snippets with their IDs and scores.

---

#### `kb_get_document`
Fetch a single document by its ID.

```json
{
  "id": "file:/Users/me/project/auth.md"   // required
}
```

---

#### `kb_get_project_graph`
Return all documents and edges belonging to a project group — useful for understanding how files relate to each other.

```json
{
  "groupId": "my-project"   // optional; falls back to default_group_id
}
```

---

### Write tools (require `--write-enabled`)

#### `kb_connect_documents`
Create a directed edge between two documents, recording a semantic relationship.

```json
{
  "sourceId": "file:/Users/me/project/auth.md",
  "targetId": "file:/Users/me/project/session.md",
  "edgeType": "depends-on"   // optional, default "related"
}
```

Returns the edge ID.

---

#### `kb_delete_document`
Delete a document, its embeddings, and any edges connected to it.

```json
{
  "id": "file:/Users/me/project/auth.md"   // required
}
```

---

## Typical agent workflows

### Explore relationships
```
1. Call kb_get_project_graph to get the full node/edge map
2. Call kb_get_document for nodes of interest
3. Call kb_connect_documents to record new relationships you discover
```

### Answer questions from docs
```
1. Call kb_search_similar with the user's question
2. Fetch full content of top results via kb_get_document
3. Synthesise an answer from the retrieved content
```

---

## Notes

- The MCP server communicates over **stdin / stdout** using JSON-RPC 2.0 (the standard MCP `stdio` transport).
- Embeddings are generated locally using [FastEmbed](https://github.com/Anush008/fastembed-rs) — no network calls are required for indexing or search.
- The same SQLite database is shared between the Depdok desktop app and the MCP server, so any modifications or connections appear immediately in the app's Knowledge Graph view.

