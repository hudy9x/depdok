# .todo File Format Specification

## Quick Start

**Create a file named `my-task.todo` and paste the following content:**

```yaml
---
title: Weekly Sprint
assignees:
  - alias: hudy
    name: Hudy Nguyen
    avatar: /assets/hudy.png
  - alias: alice
    name: Alice Smith
    avatar: /assets/alice.png
priorities:
  high:
    color: '#ef4444'
    icon: '🔴'
  medium:
    color: '#f59e0b'
    icon: '🟡'
  low:
    color: '#10b981'
    icon: '🟢'
defaults:
  priority: medium
---

# Todo {bg: "#3b82f6", order: 1}
[ ] Buy milk {assignee: "hudy", priority: "high", due: "2024-01-30"}
[ ] Call dentist {assignee: "alice", priority: "medium"}
[ ] Review PR {tags: ["code-review", "urgent"]}

# In Progress {bg: "#eab308", order: 2}
[ ] Write documentation {assignee: "hudy", priority: "high"}
[x] Fix login bug {assignee: "alice", priority: "high", completed: "2024-01-24"}

# Done {bg: "#22c55e", order: 3}
[x] Deploy to staging {assignee: "hudy", priority: "high", completed: "2024-01-23"}
[x] Update dependencies {assignee: "alice", priority: "low", completed: "2024-01-22"}
```

Open the file in the editor and you'll see a Kanban board with colored sections!

---

## Syntax Explanation

### Overview
The `.todo` format is a human-readable task management format with YAML frontmatter for configuration and metadata support for sections and items.

### Basic Structure

```
---
[YAML Config]
---

# Section Name {metadata}
[ ] Task item {metadata}
[x] Completed task {metadata}
```

### YAML Configuration (Optional)

The config section is defined between `---` markers at the top of the file:

```yaml
---
title: Project Name
description: Optional description

assignees:
  - alias: hudy
    name: Hudy Nguyen
    avatar: /path/to/avatar.png
  - alias: john
    name: John Doe
    avatar: /path/to/avatar.png

priorities:
  high:
    color: '#ef4444'
    icon: '🔴'
  medium:
    color: '#f59e0b'
    icon: '🟡'
  low:
    color: '#10b981'
    icon: '🟢'

defaults:
  priority: medium
  assignee: hudy
---
```

#### Config Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Document title |
| `description` | string | Document description |
| `assignees` | array | List of assignee definitions |
| `priorities` | object | Priority level definitions |
| `defaults` | object | Default values for items |

### Section Syntax

Sections are defined with `#` followed by the section name and optional metadata:

```
# Section Name {bg: "#3b82f6", order: 1, limit: 5}
```

#### Section Metadata

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `bg` | string | Background color (hex) | `"#3b82f6"` |
| `order` | number | Display order | `1` |
| `limit` | number | WIP limit (future) | `5` |

### Item Syntax

Items are defined with `[ ]` for unchecked or `[x]` for checked, followed by the task text and optional metadata:

```
[ ] Task description {assignee: "hudy", priority: "high", due: "2024-01-30"}
[x] Completed task {assignee: "john", priority: "low"}
```

#### Item Metadata

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `assignee` | string | Assignee alias | `"hudy"` |
| `priority` | string | Priority level | `"high"`, `"medium"`, `"low"` |
| `due` | string | Due date | `"2024-01-30"` |
| `tags` | array | Tags | `["urgent", "bug"]` |
| `completed` | string | Completion date | `"2024-01-25"` |

## Rendering Behavior

1. **Sections** are sorted by `order` (ascending)
2. **Background colors** are applied from `bg` metadata
3. **Assignee avatars** are displayed using config definitions (future)
4. **Priority indicators** use colors from config (future)
5. **Metadata is preserved** during editing and saving

## Notes

- Config section is optional
- Section metadata is optional
- Item metadata is optional
- All metadata fields are optional
- Unrecognized metadata is preserved but ignored
- Empty lines are ignored
- Items without a section are placed in "Uncategorized"
