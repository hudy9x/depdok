# Offline-First P2P Collaborative Editing Architecture & Plan

## 1. Executive Summary & Goals

This document outlines the architecture and implementation plan for adding **peer-to-peer (P2P) real-time collaborative editing** to **Depdok** for Markdown documents (`.md`) and Excalidraw drawings (`.excalidraw`), with extensible design for other file types (`.todo`, `.mmd`).

### Key Principles
1. **Offline-First & Serverless**: Depdok is a local-first desktop application built with Tauri v2. Collaborative sessions must operate without requiring a centralized document cloud or SaaS subscription.
2. **P2P Data Delivery via WebRTC**: Text edits, canvas shapes, and cursor positions stream directly peer-to-peer using WebRTC Data Channels.
3. **CRDT Data Consistency (Yjs)**: Conflict-free Replicated Data Types (Yjs) automatically resolve concurrent edits across peers without locking or loss of data.
4. **End-to-End Encryption (E2EE)**: Room content is encrypted using AES-GCM before transmission across signaling or WebRTC channels so signaling servers cannot read document data.
5. **Seamless Disk Sync**: Local files remain stored on the user's filesystem (`.md`, `.excalidraw`). Collaborative changes auto-serialize back to disk without breaking existing file operations or draft mechanisms.

---

## 2. Technical Stack & Dependencies

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **CRDT Core** | `yjs`, `y-protocols` | Conflict-Free Replicated Data Structure for shared text and canvas trees |
| **P2P Transport** | `y-webrtc` | WebRTC DataChannel transport provider for Yjs |
| **Offline Persistence** | `y-indexeddb` | Persists Yjs binary update logs locally when offline |
| **Markdown Binding** | `@tiptap/extension-collaboration`, `@tiptap/extension-collaboration-cursor` | Binds ProseMirror / Tiptap editor state to `Y.Doc` text nodes & presence |
| **Excalidraw Binding** | `y-excalidraw` / Custom Y.Map binding | Syncs Excalidraw element trees & canvas pointers to `Y.Doc` |
| **Local Signaling Host** | Tauri Rust Backend (`tokio-tungstenite`) | Optional zero-internet local LAN signaling server embedded in the app |

---

## 3. Architecture & P2P Topology

```
+-----------------------------------------------------------------------+
|                             PEER A (Local)                            |
|                                                                       |
|  +--------------------+   +-------------------+   +----------------+  |
|  | Markdown / Canvas  |<->| Tiptap / Canvas   |<->|   Y.Doc        |  |
|  | (React Component)  |   | Editor Binding    |   | (CRDT Model)   |  |
|  +--------------------+   +-------------------+   +-------+--------+  |
|                                                           |           |
|                                                   +-------v--------+  |
|                                                   | y-webrtc       |  |
|                                                   | Provider       |  |
|                                                   +-------+--------+  |
+-----------------------------------------------------------|-----------+
                                                            |
                       WebRTC P2P DataChannel               | E2E Encrypted
                 ===========================================+ (AES-GCM)
                 |                                          |
+----------------v------------------------------------------|-----------+
|  +--------------------+   +-------------------+   +-------v--------+  |
|  | Markdown / Canvas  |<->| Tiptap / Canvas   |<->|   Y.Doc        |  |
|  | (React Component)  |   | Editor Binding    |   | (CRDT Model)   |  |
|  +--------------------+   +-------------------+   +----------------+  |
|                                                                       |
|                             PEER B (Remote)                           |
+-----------------------------------------------------------------------+

       ^                                                            ^
       |                    Signaling Handshake                     |
       +-------------------> [ Signaling Server ] <-----------------+
                              (Public / Local LAN)
                        (SDP Offer / Answer & ICE only)
```

### 3.1 Signaling & Connection Flow
WebRTC requires a lightweight signaling mechanism **only during the initial handshake** to exchange SDP offers/answers and ICE candidate IPs. Once connected, signaling is bypassed and all data flows encrypted P2P.

1. **Signaling Options**:
   - **Public Fallback**: Default signaling cluster list (e.g., `wss://signaling.yjs.dev`, `wss://y-webrtc-signaling-eu.herokuapp.com`).
   - **Embedded LAN Host**: Depdok Rust backend can run a lightweight WebSocket signaling host (`ws://0.0.0.0:4444`) for pure offline local network / office environment.
   - **Browser Multi-Tab**: `y-webrtc` automatically uses `BroadcastChannel` for instant zero-network sync across windows on the same machine.
2. **Room Key & Encryption**:
   - Every collaborative session generates a **Room ID** (UUID/Hash) and an optional **Encryption Password**.
   - `y-webrtc` uses `password` configuration to encrypt Yjs updates via Web Crypto API (AES-GCM 256-bit). Even if signaling servers pass connection handshakes, document contents remain unreadable to any third party.

---

## 4. Feature Implementation Details

### 4.1 Markdown Collaborative Editor (`MarkdownPreview.tsx`)

#### Current State Review
`MarkdownPreview.tsx` currently initializes Tiptap with `@tiptap/markdown`, `Table`, `HeadingNodeView`, `CodeBlockNodeView`, `CommentMark`, and custom pagination. Drafts are saved to IndexedDB via `draftService.saveDraft()`.

#### Refactoring for P2P Collaboration
1. **Extension Integration**:
   - Add `@tiptap/extension-collaboration` bound to `ydoc.getXmlFragment('prosemirror')`.
   - Add `@tiptap/extension-collaboration-cursor` bound to `webrtcProvider.awareness`.
2. **Initial Content & Document Seeding**:
   - **First Peer**: Reads local disk file content (`.md`), imports it into Tiptap/Yjs.
   - **Joining Peer**: Receives existing `Y.Doc` CRDT state from online peers. Local disk file is updated to match the shared state once synchronized.
3. **Draft & File Disk Save Strategy**:
   - As remote edits arrive, Tiptap's Prosemirror state updates.
   - `onUpdate` triggers existing debounced file saver (`draftService.saveDraft` + `write_file_content`), ensuring local disk remains updated with live collaborative edits.

```typescript
// Conceptual Setup in MarkdownPreview.tsx
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";

export function useCollaborativeMarkdown(filePath: string, roomId?: string, password?: string) {
  const [ydoc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<WebrtcProvider | null>(null);

  useEffect(() => {
    if (!roomId) return;
    const p = new WebrtcProvider(roomId, ydoc, {
      signaling: ["wss://signaling.yjs.dev"],
      password,
    });
    setProvider(p);
    return () => p.destroy();
  }, [roomId, password, ydoc]);

  return { ydoc, provider };
}
```

---

### 4.2 Excalidraw Collaborative Canvas (`ExcalidrawPreview.tsx`)

#### Current State Review
`ExcalidrawPreview.tsx` manages Excalidraw canvas state by reading `.excalidraw` JSON files, updating via `excalidrawAPI.updateScene()`, and saving back to disk.

#### Yjs P2P Sync for Excalidraw
1. **Shared Element Map**:
   - Store canvas elements inside `ydoc.getMap<ExcalidrawElement>('excalidraw-elements')`.
2. **Real-time Synchronization**:
   - Local element creation/modification updates `Y.Map`.
   - `Y.Map.observe()` listens to peer modifications and invokes `excalidrawAPI.updateScene({ elements: Array.from(yMap.values()) })`.
3. **Presence & Canvas Cursors**:
   - Broadcast remote pointer coordinates (`x, y`), active tool, and username via `webrtcProvider.awareness`.
   - Render remote collaborator cursors overlaying the canvas.

---

### 4.3 Collaboration Management UI & Session Sharing

1. **Top Bar / Menu Control**:
   - "Share / Collaborate" button in the Markdown and Excalidraw top toolbars.
   - Dialog displaying:
     - **Session Link / Room Code**: e.g., `depdok://collab?room=xxx&key=yyy`
     - **QR Code**: Quick mobile/tablet scanning.
     - **Connected Peers List**: Badges showing active collaborator names, colors, and connection status (Connected, Syncing, Offline).
     - **Signaling Mode Selector**: "Public Relay" or "Local Network (LAN)".
2. **User Identity & Color Tokens**:
   - Assign user display name and avatar color stored in `localStorage` (`user-collab-profile`).
   - Propagate profile across `provider.awareness`.

---

## 5. Offline Persistence & Recovery

1. **Yjs IndexedDB Persistence (`y-indexeddb`)**:
   - Bind `IndexeddbPersistence` to the `Y.Doc`.
   - When launching the app without network access, local CRDT updates are loaded instantly from IndexedDB.
   - When network reconnects, local offline updates automatically delta-sync with remote peers without edit loss.
2. **FileSystem Fallback**:
   - In case of application restart, if IndexedDB is cleared, the `.md` or `.excalidraw` file on disk acts as the fallback seed document.

---

## 6. Implementation Phasing & Milestones

### Phase 1: Core P2P Setup & Dependency Integration
- Add dependencies (`yjs`, `y-webrtc`, `y-indexeddb`, `@tiptap/extension-collaboration`, `@tiptap/extension-collaboration-cursor`).
- Create reusable `CollaborativeSessionManager` hook (`src/lib/collaboration/`).

### Phase 2: Markdown Collaborative Integration
- Extend `MarkdownPreview.tsx` to support optional `collaborationConfig` prop.
- Integrate Tiptap Collaboration & Cursor extensions.
- Add remote user selection highlights & multi-cursor rendering.

### Phase 3: Excalidraw Collaborative Integration
- Extend `ExcalidrawPreview.tsx` with Yjs `Y.Map` element sync and presence pointers.
- Implement smooth scene update throttling.

### Phase 4: UI Toolbar & Session Sharing Dialog
- Build `ShareCollaborateDialog.tsx` with Room ID generator, link copying, QR code, and peer indicators.
- Add user profile settings (Name, Color).

### Phase 5: LAN Signaling & E2E Encryption Testing
- Support custom LAN signaling endpoints (`ws://<local-ip>:4444`).
- Validate AES-GCM 256-bit room password encryption.
- Verification across multiple windows and network interfaces.
