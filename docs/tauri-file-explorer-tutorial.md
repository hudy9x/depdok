# Tutorial: Building a Professional File Explorer in Tauri with React

This comprehensive guide will teach you how to build a fully functional file explorer from scratch using Tauri and React. We will avoid complex virtualization libraries like `react-virtuoso` and use simple, understandable React components.



## Prerequisites
- Basic knowledge of Rust and React.
- A Tauri project set up (`npm create tauri-app@latest`).
- State management library: `jotai` (Simple, flexible, and atomic).



## Overview

We will build a File Explorer that bridges the gap between the OS file system (Rust) and the UI (React).

```ascii
+-----------------------+          +------------------------+
|   Rust Backend        |          |    React Frontend      |
|  (File System Access) |          |      (UI & State)      |
|                       |  Tauri   |                        |
|  [ read_dir    ] <----|--Invoke--|--> [ useEffect()    ]  |
|  [ create_file ] <----|--Invoke--|--> [ handleCreate() ]  |
|  [ delete_node ] <----|--Invoke--|--> [ handleDelete() ]  |
|                       |          |                        |
+-----------------------+          +-----------+------------+
                                               |
                                        +------+-------+
                                        |  Global State |
                                        |   (Jotai)     |
                                        +---------------+
                                        | expandedFolders|
                                        | selectedPath   |
                                        | clipboardState |
                                        +---------------+
```

## Outline

1.  **[Part 1: Architecture & State Management](#part-1-architecture--state-management-global-config)**
-   Setting up global stores for selection, expansion, and clipboard.
2.  **[Part 2: Backend Setup (Rust)](#part-2-backend-setup-rust)**
-   Implementing secure filesystem commands.
3.  **[Part 3: The Recursive File Tree (Frontend)](#part-3-the-recursive-file-tree-frontend)**
    -   Building a component that can render infinite folders.
4.  **[Part 4: File Operations (CRUD)](#part-4-file-operations-crud)**
    -   Create, Rename, Delete logic.
5.  **[Part 5: Clipboard Operations](#part-5-clipboard-operations-copycutpaste)**
    -   Professional Cut/Copy/Paste workflow.
6.  **[Part 6: Wiring It All Together](#part-6-wiring-it-all-together-apptsx)**
    -   Final integration.
7.  **[Part 7: Scaling with react-virtuoso (Optional)](#part-7-scaling-with-react-virtuoso-optional)**
    -   Handling thousands of files efficiently.

---

## 📦 Required Crates (Rust)

Add the following to your `src-tauri/Cargo.toml` dependencies. These are essential for file system operations and serialization.

```toml
[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
# For easier recursive operations (optional, tutorial uses std::fs manually)
# fs_extra = "1.3" 
```

## 🧩 Part 1: Architecture & State Management (Global Config)

Before writing any UI, we need a robust state management system. We'll use **Jotai** atoms to create small, manageable pieces of state that can be shared across our application.

### Why separate state?
By decoupling state from components, we can easily access the currently selected file or clipboard content from anywhere (e.g., a top menu bar, a context menu, or a keyboard shortcut handler).

### Step 1: Create the Store (`src/store.ts`)

```typescript
import { atom } from 'jotai';

// 1. Workspace Root
// The root folder path that is currently opened.
// Sample: "/Users/username/projects/my-app"
export const workspaceRoot = atom<string | null>(null);

// 2. Expanded Folders
// A Set containing the paths of all currently expanded folders.
// We use a Set for O(1) lookup performance.
// Sample: Set { "/Users/username/projects/my-app/src", "/Users/username/projects/my-app/src/components" }
export const expandedFolders = atom<Set<string>>(new Set());

// 3. Selected Path
// The path of the currently selected file or folder.
// Sample: "/Users/username/projects/my-app/package.json"
export const selectedPath = atom<string | null>(null);

// 4. Clipboard State
// Tracks files for Copy/Cut operations.
// Sample: { paths: ["/Users/username/projects/my-app/src/utils.ts"], op: 'cut' }
export const clipboardState = atom<{
  paths: string[];
  op: 'cut' | 'copy';
} | null>(null);

// 5. File Tree Data (Optional but recommended)
// A map of folder paths to their children (FileEntry[]).
// This serves as a cache so we don't re-fetch data constantly.
// Sample: {
//   "/Users/username/projects/my-app": [
//     { name: "src", path: "...", is_dir: true },
//     { name: "package.json", path: "...", is_dir: false }
//   ]
// }
export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileEntry[];
}

export const fileTreeData = atom<Record<string, FileEntry[]>>({});
```

---

## 🦀 Part 2: Backend Setup (Rust)

We need Rust commands to interact with the file system securely. Tauri provides a bridge between the frontend and the underlying OS.

### Step 1: Define the Data Structure (`src-tauri/src/main.rs`)

```rust
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    // We don't include children here to keep the initial fetch lightweight.
    // Children are fetched on demand.
}
```

### Step 2: Implement Commands

Implement `open_folder_dialog` to pick a root folder and `read_directory` to list contents.

```rust
use tauri::api::dialog::blocking::FileDialogBuilder;

#[tauri::command]
fn open_folder_dialog() -> Option<String> {
    FileDialogBuilder::new().pick_folder().map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
fn read_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let mut entries = Vec::new();
    let paths = fs::read_dir(path).map_err(|e| e.to_string())?;

    for path in paths {
        let path = path.map_err(|e| e.to_string())?.path();
        let name = path.file_name().unwrap().to_string_lossy().to_string();
        let is_dir = path.is_dir();

        // Skip hidden files if desired
        if name.starts_with(".") { continue; }

        entries.push(FileEntry {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir,
        });
    }

    // Sort: Folders first, then files
    entries.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.cmp(&b.name)
        } else {
            b.is_dir.cmp(&a.is_dir)
        }
    });

    Ok(entries)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            open_folder_dialog,
            read_directory,
            // Add other commands here later
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 🌲 Part 3: The Recursive File Tree (Frontend)

```ascii
[FileExplorer]
    |
    +-- [FileTree parentPath="/"]
          |
          +-- [FileTreeItem "src" (is_dir=true)]
          |     |
          |     +-- [FileTree parentPath="/src"]  <-- Recursive Call!
          |           |
          |           +-- [FileTreeItem "components"]
          |           +-- [FileTreeItem "App.tsx"]
          |
          +-- [FileTreeItem "package.json"]
```

Now for the UI. We'll build a recursive component structure: `FileExplorer` -> `FileTree` -> `FileTreeItem` (which renders `FileTree` again for children).

### Step 1: The Item Component (`FileTreeItem.tsx`)

This component renders a single file or folder row.

```tsx
import { useAtom, useSetAtom } from 'jotai';
import { 
  expandedFolders, 
  selectedPath, 
  clipboardState 
} from './store';
import { ChevronRight, ChevronDown, Folder, File } from 'lucide-react';
import { invoke } from '@tauri-apps/api/tauri';

interface FileTreeItemProps {
  entry: FileEntry;
  depth: number;
  onRefresh: () => void; // Callback to refresh parent
}

export function FileTreeItem({ entry, depth, onRefresh }: FileTreeItemProps) {
  const [expanded, setExpanded] = useAtom(expandedFolders);
  const [selected, setSelected] = useAtom(selectedPath);
  const [clipboard] = useAtom(clipboardState);
  
  const isExpanded = expanded.has(entry.path);
  const isSelected = selected === entry.path;
  
  // Visual feedback for "Cut" operation
  const isCut = clipboard?.op === 'cut' && clipboard.paths.includes(entry.path);

  const toggleExpand = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!entry.is_dir) return;

    const newSet = new Set(expanded);
    if (isExpanded) {
      newSet.delete(entry.path);
    } else {
      newSet.add(entry.path);
    }
    setExpanded(newSet);
  };

  const handleSelect = () => {
    setSelected(entry.path);
  };

  return (
    <div>
      {/* 1. The Row Itself */}
      <div 
        className={`flex items-center p-1 cursor-pointer hover:bg-gray-100 ${isSelected ? 'bg-blue-100' : ''} ${isCut ? 'opacity-50' : ''}`}
        style={{ paddingLeft: `${depth * 20}px` }}
        onClick={handleSelect}
      >
        <span onClick={toggleExpand} className="mr-1">
          {entry.is_dir ? (
             isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
          ) : <span className="w-4" />}
        </span>
        
        {entry.is_dir ? <Folder size={16} className="mr-2 text-yellow-500" /> : <File size={16} className="mr-2 text-gray-500" />}
        
        <span className="truncate">{entry.name}</span>
      </div>

      {/* 2. Children (Recursive Render) */}
      {entry.is_dir && isExpanded && (
        <FileTree 
           parentPath={entry.path} 
           depth={depth + 1} 
           onRefresh={onRefresh}
        />
      )}
    </div>
  );
}
```

### Step 2: The Tree Container (`FileTree.tsx`)

This component fetches data for a specific folder and renders the list of `FileTreeItem`s.

```tsx
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { FileTreeItem } from './FileTreeItem';
import { FileEntry } from './store';

interface FileTreeProps {
  parentPath: string;
  depth?: number;
  onRefresh?: () => void;
}

export function FileTree({ parentPath, depth = 0 }: FileTreeProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);

  const loadFiles = async () => {
    try {
      const entries = await invoke<FileEntry[]>('read_directory', { path: parentPath });
      setFiles(entries);
    } catch (err) {
      console.error("Failed to load files:", err);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [parentPath]);

  return (
    <div>
      {files.map(file => (
        <FileTreeItem 
          key={file.path} 
          entry={file} 
          depth={depth}
          onRefresh={loadFiles} 
        />
      ))}
    </div>
  );
}
```

---

## 🛠️ Part 4: File Operations (CRUD)

We'll add context menu or keyboard support for basic operations.

### 1. Create Folder (`create_directory`)

**Rust:**
```rust
#[tauri::command]
fn create_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| e.to_string())
}
```

**React:**
```typescript
// useFileOperations.ts
const createFolder = async (parentPath: string, name: string) => {
  await invoke('create_directory', { path: `${parentPath}/${name}` });
  // Then refresh the UI (e.g., by re-fetching the parent folder)
};
```

### 2. Rename (`rename_node`)

**Rust:**
```rust
#[tauri::command]
fn rename_node(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(old_path, new_path).map_err(|e| e.to_string())
}
```

### 3. Delete Recursively (`delete_node`)

**Rust:**
```rust
#[tauri::command]
fn delete_node(path: String) -> Result<(), String> {
    let path_obj = Path::new(&path);
    if path_obj.is_dir() {
        fs::remove_dir_all(path).map_err(|e| e.to_string())
    } else {
        fs::remove_file(path).map_err(|e| e.to_string())
    }
}
```

---

## 📋 Part 5: Clipboard Operations (Copy/Cut/Paste)

```ascii
   [User Action]       [Clipboard State]           [UI Feedback]
        |                     |                          |
   CMD+C (Copy)  --->  {op: 'copy', paths: [...]} ---> (No Change)
        |                     |
   CMD+X (Cut)   --->  {op: 'cut', paths: [...]}  ---> Opacity: 0.5
        |                     |
   CMD+V (Paste) --->  Read State & Execute   ---> Refresh Tree
                              |
                       [Rust Backend]
                       copy_node() / rename_node()
```

This is a key feature for a "Pro" file explorer.

### Step 1: Rust Commands (`src-tauri/src/main.rs`)

We need a recursive copy function since `fs::copy` only copies files.

```rust
// Basic recursive copy implementation
fn copy_recursive(src: &Path, dest: &Path) -> std::io::Result<()> {
    if src.is_dir() {
        fs::create_dir_all(dest)?;
        for entry in fs::read_dir(src)? {
            let entry = entry?;
            let entry_path = entry.path();
            let dest_path = dest.join(entry.file_name());
            copy_recursive(&entry_path, &dest_path)?;
        }
    } else {
        fs::copy(src, dest)?;
    }
    Ok(())
}

#[tauri::command]
fn copy_node(src: String, dest: String) -> Result<(), String> {
    copy_recursive(Path::new(&src), Path::new(&dest)).map_err(|e| e.to_string())
}
```

### Step 2: React Logic (`useFileOperations.ts`)

```typescript
import { useAtom } from 'jotai';
import { clipboardState, selectedPath } from './store';

export function useFileOperations() {
  const [clipboard, setClipboard] = useAtom(clipboardState);
  
  const copy = (paths: string[]) => {
    setClipboard({ paths, op: 'copy' });
  };

  const cut = (paths: string[]) => {
    setClipboard({ paths, op: 'cut' });
  };

  const paste = async (destinationFolder: string) => {
    if (!clipboard) return;

    for (const srcPath of clipboard.paths) {
      const fileName = srcPath.split(/[/\\]/).pop();
      const destPath = `${destinationFolder}/${fileName}`;

      if (clipboard.op === 'copy') {
        await invoke('copy_node', { src: srcPath, dest: destPath });
      } else {
        // Move = Rename (if on same partition)
        await invoke('rename_node', { oldPath: srcPath, newPath: destPath });
      }
    }

    if (clipboard.op === 'cut') {
      setClipboard(null);
    }
    
    // Trigger refresh here
  };
  
  return { copy, cut, paste };
}
```

---

## 🔌 Part 6: Wiring It All Together (`App.tsx`)

Finally, put everything into the main application.

```tsx
import { useAtom } from 'jotai';
import { workspaceRoot } from './store';
import { FileTree } from './FileTree';
import { invoke } from '@tauri-apps/api/tauri';

function App() {
  const [root, setRoot] = useAtom(workspaceRoot);

  const handleOpenFolder = async () => {
    const path = await invoke<string>('open_folder_dialog');
    if (path) setRoot(path);
  };

  return (
    <div className="h-screen flex">
      <div className="w-64 border-r overflow-auto">
        {!root ? (
          <button onClick={handleOpenFolder}>Open Folder</button>
        ) : (
          <FileTree parentPath={root} />
        )}
      </div>
      <div className="flex-1 p-4">
        <h1>Editor Area</h1>
      </div>
    </div>
  );
}
```

This concludes the basic tutorial. You now have a functional file explorer with recursive rendering, state management, and basic file operations!

---

## 🚀 Part 7: Scaling with `react-virtuoso` (Optional)

When dealing with folders containing thousands of files, rendering every DOM node recursively will crash the browser. We need **Virtualization** (windowing) to only render visible items.

### The Problem: Recursive vs Flat
`react-virtuoso` expects a **flat list** array, but our file system is a **tree**.

```ascii
[Tree Structure]                 [Virtuoso Requirement]
    /                                     |
+-- src                                   |
|   +-- components                 [ "src",
|       +-- Button.tsx               "components",
+-- package.json                     "Button.tsx",
                                     "package.json" ]
```

### Solution: Flatten the Tree
We must convert our improved recursive structure into a linear array where each item knows its `depth`.

```ascii
[Flat List with Depth]
-------------------------------------------------------
Index | Name           | Depth | Padding (Depth * 20px)
-------------------------------------------------------
  0   | src            |   0   |   0px
  1   | components     |   1   |  20px
  2   | Button.tsx     |   2   |  40px
  3   | package.json   |   0   |   0px
-------------------------------------------------------
```

#### 1. Define Flat Node
```typescript
interface FlatNode extends FileEntry {
  depth: number;
  isOpen: boolean;
}
```

#### 2. Flattening Function
```typescript
// A memoized function to flatten the tree based on expanded folders
const flattenTree = (
  entries: FileEntry[], 
  expanded: Set<string>, 
  depth = 0
): FlatNode[] => {
  return entries.flatMap(entry => {
    const node: FlatNode = { ...entry, depth, isOpen: expanded.has(entry.path) };
    
    // If folder is open, insert its flattened children immediately after
    if (entry.is_dir && expanded.has(entry.path) && entry.children) {
      return [node, ...flattenTree(entry.children, expanded, depth + 1)];
    }
    
    return [node];
  });
};
```

#### 3. Using Virtuoso
Instead of the recursive `FileTree` component, use a single `Virtuoso` list. The key trick is using `paddingLeft` based on `node.depth`.

```tsx
import { Virtuoso } from 'react-virtuoso';

export function VirtualizedFileTree() {
  const flatData = useMemo(() => flattenTree(rootEntries, expandedIds), [rootEntries, expandedIds]);

  return (
    <Virtuoso
      style={{ height: '100%' }}
      data={flatData}
      itemContent={(index, node) => (
        <div 
          className="flex items-center hover:bg-gray-100 cursor-pointer"
          // CRITICAL: Visual indentation logic
          style={{ paddingLeft: `${node.depth * 20}px` }} 
          onClick={() => handleToggle(node)}
        >
           {/* Render your Icon and Name here as normal */}
           {node.is_dir ? <Folder /> : <File />}
           {node.name}
        </div>
      )}
    />
  );
}
```

### Key Takeaway
Virtualization requires you to manage the visual hierarchy manually via CSS (`padding-left`) instead of DOM nesting. This allows you to render 100,000 files with zero performance lag!
