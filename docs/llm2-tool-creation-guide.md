# LLM v2 Tool Creation Guide (Frontend Tool-Calling with Rig & Tauri)

This document is a comprehensive guide for developers and AI coding agents on how to create, register, and wire new tools into Depdok's **LLM v2 subsystem** (`src-tauri/src/llm2/` and `src/features/LLMChat2/`).

---

## 1. High-Level Architecture Overview

In Depdok LLM v2, **Rust (`rig-core`) orchestrates the LLM completion and multi-turn loops**, while **React / TypeScript executes the tools on the client side**.

```
┌───────────────────────────┐    Tauri IPC ("llm2_send_message")    ┌───────────────────────────┐
│                           │ ────────────────────────────────────> │                           │
│   React UI / Frontend     │                                       │   Rust LLM Orchestrator   │
│   (Tool Execution Engine) │ <──────────────────────────────────── │   (Rig + Ollama)          │
│                           │     Tauri Event ("tool_request")      └─────────────┬─────────────┘
│                           │                                                     │
│                           │    Tauri Command ("llm2_tool_result")               │ HTTP
│                           │ ────────────────────────────────────> ┌─────────────▼─────────────┐
│                           │                                       │   Ollama Local Server     │
│                           │ <──────────────────────────────────── │   (qwen3.5:4b)            │
└───────────────────────────┘          Final Synthesized Answer     └───────────────────────────┘
```

### Why Frontend Tool Execution?
Desktop apps require tools that directly interact with:
- React state (Jotai stores, tabs, active documents).
- UI dialogs and notifications (`sonner` toasts).
- Dynamic file tree refreshing (`refreshDirectoryAtom`).
- Client-side data, DOM, canvas, and browser storage.

---

## 2. Step-by-Step Guide: Adding a New Tool

Adding a tool requires **4 simple steps**:

```
[1] Create TS Function      -->  src/features/LLMChat2/tools/<toolName>.ts
[2] Register in Listener    -->  src/features/LLMChat2/hooks/useToolListener.ts
[3] Define Rust Tool Struct -->  src-tauri/src/llm2/tools.rs
[4] Register in Rust Agent  -->  src-tauri/src/llm2/agent.rs
```

---

### Step 1: Implement the Frontend Tool Logic

Create your TypeScript tool file in `src/features/LLMChat2/tools/<toolName>.ts`.

```typescript
// src/features/LLMChat2/tools/getWordCount.ts
import { getDefaultStore } from "jotai";
import { toast } from "sonner";
import { readFileContent } from "@/features/FileExplorer/api";
import { resolvePath } from "./pathHelper";

export interface GetWordCountArgs {
  path: string;
}

export interface GetWordCountResult {
  path: string;
  wordCount: number;
  charCount: number;
}

export async function getWordCountTool(args: GetWordCountArgs): Promise<GetWordCountResult> {
  const fullPath = resolvePath(args.path);

  try {
    const content = await readFileContent(fullPath);
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const chars = content.length;

    toast.info(`Counted ${words} words in ${fullPath.split("/").pop()}`);

    return {
      path: fullPath,
      wordCount: words,
      charCount: chars,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    toast.error(`Failed to count words: ${errorMsg}`);
    throw new Error(`Failed to read '${fullPath}': ${errorMsg}`);
  }
}
```

Export the tool in `src/features/LLMChat2/tools/index.ts`:
```typescript
export * from "./getWordCount";
```

---

### Step 2: Register Tool in Frontend Event Listener

Add your tool to the `switch (tool_name)` block in `src/features/LLMChat2/hooks/useToolListener.ts`.

```typescript
// src/features/LLMChat2/hooks/useToolListener.ts
import {
  // ... existing tools
  getWordCountTool,
  GetWordCountArgs,
} from "../tools";

// Inside useToolListener switch:
switch (tool_name) {
  // ... existing cases
  case "get_word_count":
    toolOutput = await getWordCountTool(args as unknown as GetWordCountArgs);
    break;
  default:
    throw new Error(`Unknown tool: ${tool_name}`);
}
```

---

### Step 3: Define Backend Tool Struct & JSON Schema

In `src-tauri/src/llm2/tools.rs`, implement `rig::tool::PortableTool`:

```rust
// src-tauri/src/llm2/tools.rs

// 1. Define arguments struct
#[derive(Debug, Deserialize, Serialize)]
pub struct GetWordCountArgs {
    pub path: String,
}

// 2. Define tool struct
#[derive(Clone)]
pub struct GetWordCountTool {
    pub app: AppHandle,
    pub pending: PendingRequests,
}

// 3. Implement PortableTool trait
impl PortableTool for GetWordCountTool {
    const NAME: &'static str = "get_word_count";
    type Error = ToolBridgeError;
    type Args = GetWordCountArgs;
    type Output = serde_json::Value;

    fn description(&self) -> String {
        "Count the number of words and characters in a file.".to_string()
    }

    fn parameters(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "path": { "type": "string", "description": "The path or name of the file to analyze" }
            },
            "required": ["path"]
        })
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
    }
}
```

---

### Step 4: Register Tool in Rust Agent Loop

In `src-tauri/src/llm2/agent.rs`:

1. **Import tool & args**:
   ```rust
   use super::tools::{
       // ... existing
       GetWordCountArgs, GetWordCountTool,
   };
   ```

2. **Update `SYSTEM_PROMPT`**:
   ```rust
   const SYSTEM_PROMPT: &str = "\
   You are a helpful and precise AI desktop assistant for the Depdok document editor.
   You have access to tools:
   - 'get_word_count': Count words and characters in a file (path: string).
   ...
   ";
   ```

3. **Instantiate and add to `tool_defs`**:
   ```rust
   let word_count_tool = GetWordCountTool { app: app.clone(), pending: pending.clone() };

   let tool_defs = vec![
       // ... existing tools
       portable_tool_definition(&word_count_tool),
   ];
   ```

4. **Add match case in the execution loop**:
   ```rust
   "get_word_count" => {
       let args: GetWordCountArgs = serde_json::from_value(tool_call.function.arguments.clone())
           .map_err(|e| e.to_string())?;
       word_count_tool.call(args).await.map_err(|e| e.to_string())?
   }
   ```

---

## 3. Tool Development Conventions & Best Practices

### A. Path Resolution
Tools operating on files or directories should use `resolvePath()` from `pathHelper.ts`. If the user/LLM passes a relative path (e.g. `"notes.md"`), it is automatically resolved against `workspaceRootAtom`.

```typescript
import { resolvePath, getParentDir } from "./pathHelper";

const fullPath = resolvePath(args.path);
const parentDir = getParentDir(fullPath);
```

### B. Accessing Jotai Stores Outside React Components
Since tool functions are standard async functions called by the event listener, use Jotai's `getDefaultStore()` to read and set atom values:

```typescript
import { getDefaultStore } from "jotai";
import { refreshDirectoryAtom, workspaceRootAtom } from "@/features/FileExplorer/store";
import { tabsAtom, closeTabAtom } from "@/stores/TabStore";

const store = getDefaultStore();
const root = store.get(workspaceRootAtom);

// Trigger actions
await store.set(refreshDirectoryAtom, parentDir);
```

### C. Error Handling
- Throw descriptive errors inside your TS tool (`throw new Error(...)`).
- The bridge catches the error, marks the tool log as `"error"`, and sends `{ Err: errorMsg }` back to Rust.
- Rust feeds the error back to Ollama in the `ToolResult` turn, allowing the LLM to explain the error or attempt a recovery.

### D. Return Values
Always return JSON-serializable plain objects or primitives (`string`, `number`, `boolean`, `object`, `array`). Avoid returning functions, DOM elements, or Promises.

---

## 4. Existing Built-in Tools Reference

| Tool Name | Frontend Source | Backend Source | Parameters | Purpose |
|---|---|---|---|---|
| `create_file` | `tools/createFile.ts` | `tools.rs:CreateFileTool` | `{ path, content? }` | Creates file, seeds templates (.excalidraw/.xlsx), refreshes tree. |
| `create_folder` | `tools/createFolder.ts` | `tools.rs:CreateFolderTool` | `{ path }` | Creates directory, refreshes file tree. |
| `rename_file` | `tools/renameFile.ts` | `tools.rs:RenameFileTool` | `{ old_path, new_name }` | Renames file, updates active tabs, refreshes tree. |
| `rename_folder` | `tools/renameFolder.ts` | `tools.rs:RenameFolderTool` | `{ old_path, new_name }` | Renames folder, updates active tab paths, refreshes tree. |
| `delete_file_or_folder` | `tools/deleteFileOrFolder.ts` | `tools.rs:DeleteFileOrFolderTool` | `{ path }` | Deletes file/folder, closes open tabs, refreshes tree. |
| `get_user_name` | `tools/getUserName.ts` | `tools.rs:GetUserNameTool` | `{ id }` | Retrieves user name by ID from database. |
| `get_user_age` | `tools/getUserAge.ts` | `tools.rs:GetUserAgeTool` | `{ name }` | Retrieves user age by name from database. |
| `get_user_country` | `tools/getUserCountry.ts` | `tools.rs:GetUserCountryTool` | `{ name }` | Retrieves user country by name from database. |
| `get_user_dob` | `tools/getUserDob.ts` | `tools.rs:GetUserDobTool` | `{ name }` | Retrieves user date of birth by name from database. |
| `sum_four_digits` | `tools/sumFourDigits.ts` | `tools.rs:SumFourDigitsTool` | `{ a, b, c, d }` | Performs addition of 4 numbers. |

---

## 5. Verification Checklist

When adding a new tool, always verify:
1. `cargo check` in `src-tauri` completes with 0 errors.
2. `pnpm tsc --noEmit` in root completes with 0 errors.
3. Open the LLM v2 chat panel (Sparkles button in footer) and prompt the LLM to use the new tool.
4. Verify the **Tool Execution Monitor** drawer in LLM v2 panel displays the tool name, arguments, and return result in real time.
