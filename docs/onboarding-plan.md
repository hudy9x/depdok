# Depdok Onboarding Refactor Plan

> **Status**: Draft — awaiting team review  
> **Last updated**: 2026-09-02

---

## 1. Objective

Refactor the current onboarding flow so that it does not merely configure Depdok, but instead guides users toward their **first meaningful project experience**.

The new onboarding should help users:

1. Set up their basic profile.
2. Configure their preferred appearance.
3. Start or open their first project.
4. Understand that Depdok works around a project, its knowledge, memory, and AI workflows.
5. Reach their first useful result with minimal friction.

### Core principle

> **Do not teach users how Depdok works. Help them experience its value.**

The onboarding should avoid exposing technical concepts such as:

- Vector database
- Embeddings
- Ollama
- SQLite
- `.depdok`
- MCP
- Skills
- Indexing pipelines

These are implementation details, not onboarding concepts.

---

## 2. Current State (Code Audit)

### Existing files

| File | Description |
|---|---|
| `src/pages/Onboarding.tsx` | Shell page — manages step state, handlers, renders steps |
| `src/features/Onboarding/types.ts` | `OnboardingStep` type + `ONBOARDING_STEPS` metadata |
| `src/features/Onboarding/OnboardingSidebar.tsx` | Left sidebar with step navigation |
| `src/features/Onboarding/StepProfile.tsx` | Step 1 — name + avatar selection |
| `src/features/Onboarding/StepTheme.tsx` | Step 2 — light/dark/system theme picker |
| `src/features/Onboarding/StepGetStarted.tsx` | Step 3 — "Open Folder" or "Start Writing" |
| `src/features/Onboarding/OnboardingLivePreview.tsx` | Reusable preview card used in steps 1 & 2 |
| `src/lib/userProfile.ts` | Profile persistence + `isOnboarded()` / `setOnboarded()` |
| `src/pages/Checking.tsx` | App boot: checks CLI paths → onboarded flag → routes |
| `src/App.tsx` | `OnboardingGuard` — redirects to `/onboarding` if not onboarded |

### Current flow

```
Profile
   ↓
Theme
   ↓
Get Started
   ├── Open Folder → /editor
   └── Start Writing → /editor
```

### Main problem

The user can arrive at an **empty editor without understanding what Depdok is supposed to do for their project**. "Get Started" is meaningless — it does not introduce the concept of a project, knowledge, or memory.

### What does NOT exist yet

The following features described in the desired end state **do not exist** in the codebase and require significant backend work:

- Project model (Rust backend)
- Project routing (`/project/:id`)
- Knowledge indexing progress UI
- Project Memory generation
- Demo project bundle
- AI configuration flow

---

## 3. Current vs. Proposed Flow

### Current

```
Profile → Theme → Get Started → Editor (empty)
```

### Proposed (full vision)

```
Profile
   ↓
Appearance
   ↓
Start Your First Project
   ├── Open Existing Project
   ├── Create New Project
   └── Explore Demo Project
             ↓
       Project Analysis
             ↓
       Project Home
             ↓
    ┌────────┼─────────┐
    ↓        ↓         ↓
 Project   Ask About   Create
 Memory    Project     Workflow
```

AI configuration and knowledge indexing should happen **progressively**, not as mandatory onboarding steps.

---

## 4. Implementation Phases

### Phase 0 — Onboarding Shell Refactor *(current scope, no backend required)*

Replace `StepGetStarted` with `StepProjectStart` that frames Depdok around the concept of a *project*. The underlying actions (open folder → `/editor`, create folder → `/editor`) remain the same. The framing changes completely.

#### Files to change

| Action | File | Description |
|---|---|---|
| MODIFY | `src/features/Onboarding/types.ts` | Update step 2 & 3 copy |
| MODIFY | `src/features/Onboarding/OnboardingSidebar.tsx` | Update icon + subtitle |
| DELETE | `src/features/Onboarding/StepGetStarted.tsx` | Remove old step |
| NEW | `src/features/Onboarding/StepProjectStart.tsx` | New step 3 with 3 cards |
| MODIFY | `src/pages/Onboarding.tsx` | Update handlers + render |
| MODIFY | `src/lib/userProfile.ts` | Add `OnboardingState` interface |

#### Step 3 — `StepProjectStart` design

Three selectable project entry cards:

```
┌──────────────────────────────────────────────┐
│  📂  Open Existing Project        [Primary]  │
│                                              │
│  Open a project folder and let Depdok        │
│  understand its documents and structure.     │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  ✨  Create New Project        [Secondary]   │
│                                              │
│  Start a new project with a clean workspace. │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  🎬  Explore Demo Project        [Disabled]  │
│                                              │
│  See how Depdok turns project documents      │
│  into project memory and AI workflows.       │
│                                              │
│  ─── Coming soon ───                         │
└──────────────────────────────────────────────┘
```

- **Open Existing Project** → native folder picker → `openWorkspace(path)` → navigate `/editor`
- **Create New Project** → native folder picker → same behavior
- **Explore Demo Project** → disabled card with "Coming soon" tooltip

#### Copy changes

| Location | Old | New |
|---|---|---|
| Step 2 title | "Choose your theme" | "Choose your appearance" |
| Step 2 desc | "How Depdok looks while you read and write." | "Choose how Depdok looks while you work." |
| Step 3 title | "Get started" | "Start your first project" |
| Step 3 desc | "Open a folder or jump straight into writing." | "Open or create a project to get started." |
| Sidebar subtitle | "Let's get your workspace set up — it only takes a minute." | "Let's get your first project started." |

#### `OnboardingState` interface

Add to `src/lib/userProfile.ts`:

```typescript
export interface OnboardingState {
  profileCompleted: boolean;
  appearanceCompleted: boolean;
  projectCreated: boolean;
  // Future fields — not persisted yet:
  // projectAnalyzed: boolean;
  // knowledgeReady: boolean;
  // memoryCreated: boolean;
  // aiConfigured: boolean;
  // firstWorkflowCompleted: boolean;
}
```

Storage key: `depdok-onboarding-state`  
Keep `depdok-onboarded` flag intact for backward compatibility.

---

### Phase 1 — Project Activation *(requires Rust project model)*

#### Open Existing Project flow

```
Open Existing Project
        ↓
Native Folder Picker
        ↓
Analyze Project (Rust)
        ↓
Project Home (/project/:id)
```

After opening a folder, instead of jumping to the editor, show a lightweight analysis screen:

```
We found 42 files in this project.

Documents
  18 Markdown files
   7 PDFs
   4 spreadsheets
   3 diagrams
  10 other files
```

#### Create New Project flow

```
Create New Project
        ↓
Project Name
        ↓
Project Location (folder picker)
        ↓
Create Project
        ↓
Project Home (/project/:id)
```

#### Project Setup Screen

```
Setting up your project...

✓ Project workspace
✓ Documents discovered
◎ Knowledge indexed
○ Project memory
○ AI assistant
```

The user can continue using the app while setup runs in the background.

#### Knowledge Indexing (automatic)

Do **not** create a mandatory "Set up Knowledge Base" screen.

```
Open Project
     ↓
Depdok automatically indexes supported content
     ↓
Knowledge becomes available
```

UI communicates the **result**, not the implementation:

> **Project knowledge ready**  
> 42 documents · 186 indexed sections

---

### Phase 2 — Project Home *(requires project model + memory backend)*

After onboarding, land on a **Project Home**, not an empty editor.

```
PROJECT

Project Name
42 documents · Knowledge ready

────────────────────────────

PROJECT MEMORY

Current Status
Implementation is 70% complete.

Next Action
Confirm authentication requirements.

Open Issues
3 unresolved issues.

[ View Project Memory ]

────────────────────────────

KNOWLEDGE

42 documents · 186 indexed sections

[ Ask About This Project ]

────────────────────────────

AI WORKFLOWS

[ Create Project Plan ]
[ Summarize Daily Reports ]
[ Write Customer Report ]
```

#### Project Memory creation

AI analyzes: requirements, meeting notes, daily reports, technical docs, project plans, READMEs.

#### Human approval flow

```
AI analyzes project
       ↓
AI proposes memory
       ↓
User reviews
       ↓
Accept / Edit / Reject
       ↓
Project Memory becomes persistent
```

Example output:

```
PROJECT MEMORY

Current Status
Implementation is approximately 70% complete.

Important Context
The customer requires the first release before October.

Decisions
PostgreSQL was selected as the production database.

Open Issues
Authentication requirements are still unclear.

Next Actions
Finalize authentication requirements with the customer.
```

---

### Phase 3 — AI Configuration & Routing

#### AI setup — progressive, not mandatory

When the user first clicks an AI feature:

```
User clicks "Ask About This Project"
              ↓
      AI configuration check
              ↓
       ┌──────┴──────┐
       ↓             ↓
   Local AI        Cloud AI
    Ollama           BYOK
       ↓             ↓
      Setup        API Key
```

User-facing concept: **"Choose how Depdok runs AI"** — not "Install Ollama."

#### Local AI states

| State | Message |
|---|---|
| Not configured | "Local AI isn't configured yet." + [Set Up Local AI] |
| Preparing | "Preparing your local AI model... You can continue working." |
| Ready | "Local AI is ready." |
| Unavailable | "Local AI isn't available right now." + [Try Again] [Use Cloud AI] |

Raw errors stay inside an advanced diagnostics view only.

#### Routing refactor

```
/onboarding → /project/:id/setup → /project/:id
```

```
/project/:id
├── overview
├── memory
├── knowledge
├── workspace
├── editor
└── ai
```

---

## 5. Demo Project *(Phase 1)*

Bundle with the app. Optimized to demonstrate the product thesis.

```
Demo Project — "Customer Portal"
├── Requirements.md
├── Meeting Notes.md
├── Technical Architecture.md
├── Daily Report - Week 1.md
├── Daily Report - Week 2.md
└── Decisions.md
```

Example pre-built workflow:

> Create a project status report from the available project documents.

---

## 6. Empty Project Flow *(Phase 1)*

```
Your project is ready.

Start by adding your first document.

[ Create Document ]   [ Import Files ]
```

If AI is triggered without enough data:

> Add a few project documents before building Project Memory.

---

## 7. Full `ProjectStatus` Model *(Phase 2)*

```typescript
interface ProjectStatus {
  workspaceReady: boolean;
  knowledgeStatus: 'not_started' | 'indexing' | 'ready' | 'error';
  memoryStatus: 'empty' | 'generating' | 'ready';
  aiStatus: 'not_configured' | 'preparing' | 'ready' | 'unavailable';
}
```

---

## 8. Suggested Component Structure

```
src/features/
├── Onboarding/
│   ├── OnboardingShell          (Onboarding.tsx — update)
│   ├── OnboardingSidebar        (existing — update)
│   ├── OnboardingLivePreview    (existing — keep)
│   ├── StepProfile              (existing — keep)
│   ├── StepTheme                (existing — keep)
│   └── StepProjectStart         (NEW — Phase 0)
│
├── ProjectSetup/                (NEW — Phase 1)
│   ├── ProjectSetupView
│   ├── ProjectAnalyzer
│   ├── KnowledgeSetupStatus
│   ├── MemorySetup
│   └── ProjectSetupProgress
│
├── ProjectHome/                 (NEW — Phase 2)
│   ├── ProjectHome
│   ├── ProjectMemory
│   ├── ProjectKnowledge
│   └── ProjectWorkflows
│
└── AISetup/                     (NEW — Phase 3)
    ├── AISetup
    ├── LocalAISetup
    ├── BYOKSetup
    └── AIStatus
```

---

## 9. What NOT to Add

Do **not** turn onboarding into a configuration wizard containing:

- Choose LLM
- Choose embedding model
- Configure vector database
- Configure MCP
- Configure Skills
- Configure indexing

> **Configure complexity progressively, only when the user needs it.**

---

## 10. Implementation Priority

### P0 — Onboarding Shell (now, no backend required)

- [ ] Replace `StepGetStarted` → `StepProjectStart` with 3 project cards
- [ ] Update step copy (appearance, start your first project)
- [ ] Update sidebar subtitle
- [ ] Add `OnboardingState` interface to `userProfile.ts`
- [ ] "Explore Demo Project" as disabled stub

### P1 — Project Activation (requires Rust project model)

- [ ] Project analysis screen after folder open
- [ ] Automatic KB indexing trigger
- [ ] Project Home (`/project/:id`)
- [ ] Project Memory creation flow
- [ ] Human approval for Memory
- [ ] Demo Project bundle
- [ ] First AI workflow trigger

### P2 — AI & Routing

- [ ] Progressive AI configuration on first use
- [ ] Local AI / BYOK setup flows
- [ ] Background model preparation
- [ ] Routing refactor (`/project/:id/...`)
- [ ] Scheduled / file-change / Git-triggered workflows

### P3 — Advanced

- [ ] Automatic Memory suggestions
- [ ] Memory conflict detection
- [ ] Project handover workflow
- [ ] Team / enterprise AI management

---

## 11. Target User Journey (Full Vision)

```
First Launch
    ↓
Profile
    ↓
Appearance
    ↓
Open Existing Project
    ↓
Depdok analyzes project (~seconds)
    ↓
Project Home
    ↓
Knowledge automatically available
    ↓
"Build Project Memory"
    ↓
User reviews and approves memory
    ↓
"Ask About This Project"
    ↓
First useful AI result
```

**Target: User reaches a meaningful result within ~3 minutes.**

---

## 12. Product Architecture (communicated through UX)

```
                    DEP DOK
                       │
                 ┌─────▼─────┐
                 │  PROJECT  │
                 └─────┬─────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
      Workspace     Knowledge     Memory
          │            │            │
          └────────────┼────────────┘
                       ▼
                  AI Assistant
                       │
                 ┌─────┴─────┐
                 │           │
              Skills      Workflows
                 │           │
                 └─────┬─────┘
                       ▼
                 Useful Output
```

The key product loop:

> **Capture → Understand → Remember → Work**

Not:

> **Configure → Open Editor → Start Writing**.
