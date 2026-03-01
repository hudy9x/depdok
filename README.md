# Depdok

A macOS-first documentation editor built specifically for developers who write technical docs — not code.

This project focuses on **Markdown + diagram-driven documentation**, with an emphasis on **interactive previews**, **offline usage**, and a **developer-friendly workflow**.

---

## ✨ What is this?

This is a lightweight desktop application for writing **technical documentation**, such as:

- Design documents
- Architecture overviews
- Sequence diagrams
- Developer-facing markdown docs

Unlike general-purpose editors or note-taking apps, this tool treats **documentation and diagrams as first-class citizens**, not side features.

---

## 🎯 Key Features (MVP)

### Markdown Editing
- Dual-mode editing:
  - **Code mode** (raw Markdown)
  - **Preview mode** (rendered, powered by TipTap)
- Real-time preview
- Editor ↔ Preview **scroll synchronization**

### Diagram Support (Core Differentiator)
- Native support for **Mermaid `sequenceDiagram`** (offline)
- Code + Preview modes for diagrams
- **Interactive diagram preview**:
  - Click a diagram element to jump to its source code
  - Fold / unfold `alt` blocks
  - Hover to highlight related code

> Diagrams are parsed into an internal AST, enabling structured interactions instead of static rendering.

### Export
- Export documentation to:
  - **PDF**
  - **PNG** (for diagrams)
- Export output matches the preview (WYSIWYG)

### Workflow
- Open and edit local folders
- Works seamlessly with Git repositories
- Fully **offline** and **local-first**

---

## 📥 Installation

### macOS - Homebrew
If you have Homebrew installed, you can simply install via:

```bash
# 1. Tap the repository
brew tap hudy9x/depdok https://github.com/hudy9x/depdok

# 2. Install the app
brew install --cask depdok
```
*Tip: If you encounter permission issues, add the `--no-quarantine` flag.*

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/hudy9x/depdok/main/install.ps1 | iex
```

---

## 🚫 What this is NOT
- Not a code editor
- Not a note-taking or “second brain” app
- Not a plugin-heavy or cloud-based platform

The goal is focus, clarity, and a streamlined documentation workflow for developers.

---

## 🧠 Design Principles
- Documentation-first, developer-centric
- Opinionated and minimal
- Structured content over free-form text
- Offline by default

---

## 🛠 Tech Stack
- **Desktop framework:** Tauri
- **UI framework:** React
- **Rendering:** AST-driven Markdown & diagram rendering
- **Target platform:** macOS

---

## 📌 Project Status
This project is currently in **early development / MVP exploration**.

Scope is intentionally limited to validate the core idea:
> *interactive, diagram-aware technical documentation for developers.*

---

## 📄 License
TBD
