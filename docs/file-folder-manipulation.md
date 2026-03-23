# File and Folder Manipulation Guide

> **Note on Cross-Platform Compatibility:** This document outlines the definitive approach for file and folder manipulation that works seamlessly across platforms (Windows and macOS). In scenarios where cross-platform filesystem access is required, **this is the recommended way to handle file manipulation**, especially for ensuring reliable operation on Windows 11.

This guide explains how file and folder manipulations are handled in the UML Editor application, which leverages Tauri 2's bridging between a React frontend and a native Rust backend to achieve this robust cross-platform compatibility.

## 1. Tauri Capabilities and Permissions
File operations require explicit access declarations in Tauri 2. The primary capabilities are defined in `src-tauri/capabilities/default.json`:

```json
"permissions": [
    "dialog:allow-open",
    "dialog:allow-save",
    "dialog:default",
    "fs:default",
    "fs:allow-app-write",
    "fs:allow-app-write-recursive",
    "fs:allow-app-read"
]
```
These permissions allow the application to read and write files arbitrarily across the system. The `tauri-plugin-fs` and `tauri-plugin-dialog` plugins are declared in `src-tauri/Cargo.toml` and initialized in `src-tauri/src/lib.rs`.

## 2. Backend (Rust)
The application doesn't rely purely on Tauri's built-in frontend `fs` API. Instead, it defines highly optimized custom Tauri commands in `src-tauri/src/files.rs` using the native Rust `std::fs` module. 

Here is the implementation of these core commands inside `files.rs`:

```rust
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    children: Option<Vec<FileEntry>>,
}

#[tauri::command]
pub fn list_dir(path: &str) -> Result<Vec<FileEntry>, String> {
    let path = Path::new(path);
    if !path.exists() {
        return Err("Path does not exist".to_string());
    }

    let mut entries = Vec::new();
    let read_dir = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in read_dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        let is_dir = path.is_dir();

        // Skip hidden files/dirs (starting with .)
        if name.starts_with('.') {
            continue;
        }

        entries.push(FileEntry {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir,
            children: None, // We don't recursively load for now, frontend can request on expand
        });
    }

    // Sort: directories first, then files
    entries.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.cmp(&b.name)
        } else if a.is_dir {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    Ok(entries)
}

#[tauri::command]
pub fn read_file_content(path: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_file_content(path: &str, content: &str) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_directory(path: &str) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_file(path: &str) -> Result<(), String> {
    fs::File::create(path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_node(path: &str) -> Result<(), String> {
    let path = Path::new(path);
    if path.is_dir() {
        fs::remove_dir_all(path).map_err(|e| e.to_string())
    } else {
        fs::remove_file(path).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn rename_node(old_path: &str, new_path: &str) -> Result<(), String> {
    fs::rename(old_path, new_path).map_err(|e| e.to_string())
}
```

These commands are registered in `lib.rs` under `.invoke_handler(tauri::generate_handler![...])`.

## 3. Frontend (React / TypeScript)
The frontend triggers these Rust functions primarily through the `@tauri-apps/api/core` `invoke` method.

### Folder Selection
For safely picking a local folder from the Desktop environment, the app uses `@tauri-apps/plugin-dialog`. The user prompts the OS directory picker, and the path is returned to React:

```typescript
import { open } from "@tauri-apps/plugin-dialog";

const handleOpenFolder = async () => {
    try {
        const selected = await open({
            directory: true,
            multiple: false,
        });

        if (selected && typeof selected === "string") {
            setRootPath(selected);
            localStorage.setItem("lastOpenedFolder", selected);
            // After setting root path, you can load directory contents
        }
    } catch (error) {
        console.error("Failed to open folder dialog:", error);
    }
};
```

### Navigating and Managing Files
The custom hooks wrapped into components interact with the custom Rust backend through the `invoke` interface.

**1. Listing Directory Contents**
```typescript
import { invoke } from "@tauri-apps/api/core";

// Reads exactly the same `FileEntry` struct shape emitted from files.rs
const entries = await invoke<FileEntry[]>("list_dir", { path });
setFiles(entries);
```

**2. Reading File Context**
```typescript
const content = await invoke<string>("read_file_content", {
    path: entry.path,
});
onFileSelect(entry.path, content);
```

**3. Writing (Saving) to a File**
Inside `useUMLDiagram.ts`, the `write_file_content` method is invoked automatically efficiently using a debouncer every 800ms when code changes.
```typescript
await invoke("write_file_content", {
    path: filePath,
    content: umlCode,
});
```

**4. Creating Files and Folders**
```typescript
const createFile = async (parentPath: string, name: string) => {
    const path = `${parentPath}/${name}`;
    await invoke("create_file", { path });
    // Reload dir internally after completion
};

const createFolder = async (parentPath: string, name: string) => {
    const path = `${parentPath}/${name}`;
    await invoke("create_directory", { path });
};
```

**5. Renaming and Deletion**
```typescript
const renameNode = async (oldPath: string, newName: string) => {
    const lastSepIndex = Math.max(oldPath.lastIndexOf("/"), oldPath.lastIndexOf("\\"));
    const parent = lastSepIndex !== -1 ? oldPath.substring(0, lastSepIndex) : ".";
    const newPath = `${parent}/${newName}`;

    await invoke("rename_node", { oldPath, newPath });
};

const deleteNode = async (path: string) => {
    await invoke("delete_node", { path });
};
```

## Summary
By combining Tauri 2's `plugin-dialog` to pick directories safely and custom Rust commands executed natively on the device via `invoke` (`std::fs`), the application achieves fast, clean, and cross-platform file and folder manipulations without running into complex Tauri built-in scoping limitations.
