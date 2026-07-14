# Kế hoạch Nâng cấp 1: 1-Click LLM Onboarding & Model Download
**Mã tài liệu:** `docs/plan/1-llm-onboarding.md`  
**Mục tiêu:** Đơn giản hóa quá trình cài đặt mô hình LLM từ phức tạp thành trải nghiệm 1-click, sử dụng dữ liệu phần cứng thực tế để đề xuất mô hình phù hợp, và hiển thị màn hình Onboarding đúng một lần duy nhất.  
**Tài liệu tham chiếu:** [Đề xuất Cải tiến & GTM](file:///Users/hudy/ws/depdok/docs/marketing/3-product_improvements.md)

---

## 1. Phân Tích Hiện Trạng Codebase

### A. Kiến trúc Routing (App.tsx)
Hiện tại, ứng dụng có 3 routes chính:
```
/          → Checking.tsx  (kiểm tra pending paths & sessionStorage tabs)
/home      → Home.tsx      (welcome screen + open file/folder)
/editor    → Editor.tsx    (main editor)
```
**Vấn đề:** Không có route `/onboarding`. Cần thêm route này và nhúng logic kiểm tra vào `Checking.tsx`.

### B. State Persistence (Tauri Store)
- Store file: `store.json` (dùng `@tauri-apps/plugin-store`)
- Đã có pattern sử dụng tại:
  - `useProjectStateSync.ts` → `depdok-projects-state`
  - `FileExplorer/store.ts` → `recent_folders`, `current_workspace`
  - Rust `lib.rs` → `dock_recent_folders`, `llm_config`
- **Pattern dùng trong Rust:** `app.store("store.json")` → `store.set(key, val)` → `store.save()`
- **Pattern dùng trong Frontend:** `load('store.json', { autoSave: false })` → `store.get(key)` → `store.set(key, val)` → `store.save()`

### C. LLM Config (Đã có sẵn)
- **Rust types:** `LlmConfig` (provider_type, local_model_path, custom_models_dir, api_endpoint, api_key, model_name, gpu_layers, ctx_size, max_tokens, system_prompt) trong `src-tauri/src/llm/provider.rs`
- **Tauri commands đã có:** `get_llm_config`, `save_llm_config`, `load_llm_provider`, `scan_local_llm_models`, `download_llm_model`, `get_llm_models_dir`, `reveal_llm_models_dir`
- **Frontend API:** `src/features/LLMChat/api/llm.ts` — đầy đủ wrappers, events (`llm-model-download-progress`)
- **Event download progress:** `onLlmModelDownloadProgress` đã có, emits `llm-model-download-progress` với payload là `u32` (0-100)

### D. Danh sách Model Cố Định (Vấn đề cần giải quyết)
`CURATED_MODELS` trong `LLMModelSetting.tsx` là hardcode array gồm 9 models:
- Qwen2.5-7B, Qwen2.5-3B, Llama-3.2-3B, Llama-3.1-8B, Phi-3.5-mini, gemma-2-2b, DeepSeek-Coder-V2-Lite, Qwen3.5-4B, gemma-4-12b
- **Không có logic đề xuất theo RAM.** Không fetch Hugging Face API động.

### E. Hardware Detection (Chưa có)
- Không có Tauri command `detect_system_specs()` nào trong codebase.
- Cần thêm vào Rust (dùng crate `sysinfo`).

### F. Checking.tsx — Entry Point Logic
Hiện logic redirect:
1. Kiểm tra `pendingPaths` từ CLI → `/editor`
2. Kiểm tra `sessionStorage` tabs → `/editor`
3. Fallback → `/home`

**Cần thêm bước:** Kiểm tra `onboarding_completed` và `onboarding_dismissed` từ `store.json` trước khi redirect về `/home`.

---

## 2. Vấn Đề Cần Giải Quyết

| # | Vấn đề | Giải pháp |
|---|--------|-----------|
| 1 | Không có màn hình onboarding | Tạo route `/onboarding` + `OnboardingPage.tsx` |
| 2 | Model list hardcode | Giữ `CURATED_MODELS` làm base, thêm logic lọc/đề xuất theo RAM |
| 3 | Không có hardware scan | Thêm Rust command `detect_system_specs()` dùng crate `sysinfo` |
| 4 | Không có state onboarding | Lưu `onboarding_completed` / `onboarding_dismissed` vào `store.json` |
| 5 | Checking.tsx không check onboarding | Thêm bước check store trước redirect |
| 6 | Không có live demo slide | Tạo mini Mermaid preview trong slide 2 |
| 7 | Không có workspace setup slide | Slide 4: chọn folder + tạo template |

---

## 3. Kiến Trúc Giải Pháp

### A. Luồng Khởi Động App (Updated Checking.tsx)

```
App Start → Checking.tsx
    ├── pendingPaths (từ CLI)?  → /editor
    ├── sessionStorage tabs?    → /editor
    ├── onboarding_completed == true?  → /home
    ├── onboarding_dismissed == true?  → /home
    └── (first launch)         → /onboarding
```

### B. Cơ Chế Lưu Trạng Thái (store.json keys)

```typescript
// Keys cần thêm vào store.json:
"onboarding_completed": boolean   // Đã hoàn thành slide 1-4
"onboarding_dismissed": boolean   // Người dùng bấm Skip

// Đọc trong Checking.tsx:
const store = await load('store.json', { autoSave: false } as any);
const completed = await store.get<boolean>('onboarding_completed') ?? false;
const dismissed = await store.get<boolean>('onboarding_dismissed') ?? false;
```

### C. Slide Carousel (4 slides)

```
[ Slide 1: Welcome & Role ] ──► [ Slide 2: Live Demo ] ──► [ Slide 3: Hardware & AI ] ──► [ Slide 4: Workspace ]
```

---

## 4. Chi Tiết Triển Khai (Implementation Details)

### PHẦN 1: Backend Rust — Hardware Detection

#### Thêm crate `sysinfo` vào `Cargo.toml`
```toml
sysinfo = "0.32"
```

#### Thêm Tauri command `detect_system_specs` vào `src-tauri/src/lib.rs`

```rust
#[derive(Debug, Clone, serde::Serialize)]
pub struct SystemSpecs {
    pub total_ram_gb: f64,
    pub available_ram_gb: f64,
    pub cpu_brand: String,
    pub cpu_cores: u32,
    pub has_gpu: bool,
    pub gpu_name: Option<String>,
}

#[tauri::command]
fn detect_system_specs() -> SystemSpecs {
    use sysinfo::System;
    let mut sys = System::new_all();
    sys.refresh_all();

    let total_ram_gb = sys.total_memory() as f64 / 1024.0 / 1024.0 / 1024.0;
    let available_ram_gb = sys.available_memory() as f64 / 1024.0 / 1024.0 / 1024.0;

    let cpu_brand = sys.cpus().first()
        .map(|c| c.brand().to_string())
        .unwrap_or_else(|| "Unknown CPU".to_string());
    let cpu_cores = sys.cpus().len() as u32;

    // GPU detection (basic via sysinfo components)
    SystemSpecs {
        total_ram_gb,
        available_ram_gb,
        cpu_brand,
        cpu_cores,
        has_gpu: false,       // Sẽ cập nhật nếu tích hợp wgpu/nvml
        gpu_name: None,
    }
}
```

> **Lưu ý:** Đăng ký command trong `invoke_handler!(...)` tại `lib.rs`.

---

### PHẦN 2: Frontend API Client

#### `src/api-client/onboarding.ts` [NEW]
```typescript
import { invoke } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";

export interface SystemSpecs {
  total_ram_gb: number;
  available_ram_gb: number;
  cpu_brand: string;
  cpu_cores: number;
  has_gpu: boolean;
  gpu_name: string | null;
}

export const detectSystemSpecs = (): Promise<SystemSpecs> =>
  invoke("detect_system_specs");

let _store: Awaited<ReturnType<typeof load>> | null = null;
const getStore = async () => {
  if (!_store) _store = await load("store.json", { autoSave: false } as any);
  return _store;
};

export const getOnboardingState = async (): Promise<{
  completed: boolean;
  dismissed: boolean;
}> => {
  const store = await getStore();
  const completed = (await store.get<boolean>("onboarding_completed")) ?? false;
  const dismissed = (await store.get<boolean>("onboarding_dismissed")) ?? false;
  return { completed, dismissed };
};

export const setOnboardingCompleted = async (): Promise<void> => {
  const store = await getStore();
  await store.set("onboarding_completed", true);
  await store.save();
};

export const setOnboardingDismissed = async (): Promise<void> => {
  const store = await getStore();
  await store.set("onboarding_dismissed", true);
  await store.save();
};
```

---

### PHẦN 3: Updating `Checking.tsx`

Thêm bước check onboarding trước khi navigate `/home`:

```typescript
// Sau khi check sessionStorage tabs, trước fallback:
const { completed, dismissed } = await getOnboardingState();
if (completed || dismissed) {
  navigate("/home", { replace: true });
  return;
}
// First launch:
navigate("/onboarding", { replace: true });
```

---

### PHẦN 4: App.tsx — Thêm Route

```tsx
// Thêm import:
import Onboarding from './pages/Onboarding';

// Thêm route (ngoài LayoutRoute để không có sidebar):
<Route path="/onboarding" element={<Onboarding />} />
```

> **Lý do đặt ngoài LayoutRoute:** Trang onboarding là full-screen immersive, không cần Layout (titlebar, sidebar, etc.).

---

### PHẦN 5: Onboarding Feature Structure

```
src/features/Onboarding/
├── index.ts                        # Public exports
├── store/
│   └── OnboardingStore.ts          # Jotai atoms: currentSlide, selectedRole, selectedModel, specs
├── hooks/
│   └── useOnboarding.ts            # Logic điều phối: specs fetch, download, state save
├── components/
│   ├── OnboardingCarousel.tsx      # Container: animated slide transitions
│   ├── SkipButton.tsx              # Nút Skip nổi bật góc phải
│   ├── ProgressDots.tsx            # Chỉ số slide hiện tại (1/4)
│   ├── slides/
│   │   ├── Slide1Welcome.tsx       # Welcome + Role selection
│   │   ├── Slide2Demo.tsx          # Live Mermaid demo
│   │   ├── Slide3Hardware.tsx      # Hardware scan + model pick + download
│   │   └── Slide4Workspace.tsx     # Chọn folder + tạo template
│   └── hardware/
│       └── HardwareScanAnimation.tsx  # Micro-animation: scanning bars
src/pages/
└── Onboarding.tsx                  # Page wrapper
```

---

### PHẦN 6: OnboardingStore.ts

```typescript
// src/features/Onboarding/store/OnboardingStore.ts
import { atom } from "jotai";
import type { SystemSpecs } from "@/api-client/onboarding";
import type { CuratedModel } from "../types";

export type UserRole = "architect" | "writer" | "security" | null;

export const currentSlideAtom = atom<number>(0);              // 0–3
export const selectedRoleAtom = atom<UserRole>(null);
export const systemSpecsAtom = atom<SystemSpecs | null>(null);
export const selectedModelAtom = atom<CuratedModel | null>(null);
export const isSpecsScanningAtom = atom<boolean>(false);

// Existing LLM state (fetched on Slide 3 mount)
export const existingLlmConfigAtom = atom<LlmConfig | null>(null);
export const existingProviderStatusAtom = atom<LlmProviderStatus | null>(null);
export const localModelsAtom = atom<GgufModelInfo[]>([]);

// Derived: does user already have an AI model configured?
export const hasExistingModelAtom = atom<boolean>((get) => {
  const config = get(existingLlmConfigAtom);
  const localModels = get(localModelsAtom);
  if (!config) return false;
  // Remote provider (ollama, open_ai, claude, lm_studio) → always considered "configured"
  if (config.provider_type !== "local") return true;
  // Local provider → check if model path exists in scanned files
  return !!config.local_model_path &&
    localModels.some(m => m.path === config.local_model_path);
});
```

---

### PHẦN 7: Model Recommendation Logic

Logic đề xuất model theo RAM (thay thế hardcode không có filter):

```typescript
// src/features/Onboarding/lib/modelRecommendations.ts

export interface RecommendedModel {
  model: CuratedModel;
  tag: "optimal" | "good" | "heavy";
  reason: string;
}

export function getRecommendedModels(
  availableRamGb: number,
  role: UserRole,
): RecommendedModel[] {
  return CURATED_MODELS
    .map((model) => {
      // Model cần ít nhất 1.5x kích thước để chạy tốt
      const requiredRam = model.sizGb * 1.5;
      const tag: RecommendedModel["tag"] =
        requiredRam <= availableRamGb * 0.5 ? "optimal" :
        requiredRam <= availableRamGb * 0.8 ? "good" : "heavy";

      // Ưu tiên theo role
      const isRoleMatch =
        (role === "architect" && model.name.includes("Qwen")) ||
        (role === "security" && model.sizGb <= 3) ||
        (role === "writer" && !model.name.includes("Coder"));

      return {
        model,
        tag,
        reason: tag === "optimal"
          ? "Tối ưu cho máy của bạn"
          : tag === "good"
          ? "Chạy được, tốc độ trung bình"
          : "Cần nhiều RAM hơn RAM khả dụng",
        isRoleMatch,
      };
    })
    .filter((r) => r.tag !== "heavy")
    .sort((a, b) => {
      // Optimal + role match lên đầu
      if (a.tag === "optimal" && b.tag !== "optimal") return -1;
      if (a.isRoleMatch && !b.isRoleMatch) return -1;
      return a.model.sizGb - b.model.sizGb;
    });
}
```

---

### PHẦN 8: Slide 1 — Welcome & Role

```tsx
// Slide1Welcome.tsx
// Layout: Split screen (left: text, right: animated illustration)
// Left:
//   - Logo + "Welcome to Depdok"
//   - Subtitle: "A documentation editor built for developers"
//   - Role selection (3 cards với icon):
//       [ 🏗 Software Architect ]  [ ✍️ Technical Writer ]  [ 🔒 Security Enthusiast ]
//   - Mỗi card khi chọn: highlight với border + màu accent, lưu vào selectedRoleAtom

// Right:
//   - Animated SVG hoặc Lottie minh họa Depdok workflow
```

**Chi tiết UI Role Cards:**
- Kích thước: `w-full px-4 py-3 rounded-xl border-2 cursor-pointer transition-all`
- Selected state: `border-primary bg-primary/10`
- Unselected: `border-border hover:border-primary/50`
- Mỗi card có: Icon (Lucide), Title, Subtitle mô tả 1 dòng

---

### PHẦN 9: Slide 2 — Live Mermaid Demo

```tsx
// Slide2Demo.tsx
// Layout: Split screen
// Left: Monaco editor mini (read-only, syntax highlight) với Mermaid code
// Right: Mermaid rendered diagram (dùng mermaid.js instance đã có)

// Mermaid code mẫu (sequence diagram):
const DEMO_MERMAID = `
sequenceDiagram
    Developer->>Depdok: Open Markdown
    Depdok->>AI: Analyze structure
    AI-->>Depdok: Suggest improvements
    Depdok->>Developer: Show preview
`;

// Interaction:
// - Khi user click vào node trên diagram → highlight dòng tương ứng bên trái
// - Hiển thị tooltip: "Click vào actor để xem code"
// - Sau khi user đã click: nút "Tiếp theo" sáng lên

// State:
const [hasInteracted, setHasInteracted] = useState(false);
```

> **Implementation note:** Dùng `mermaid` package đã có trong dự án (được dùng trong MarkdownPreview). Tạo một `MiniMermaidPreview` component riêng cho slide.

---

### PHẦN 10: Slide 3 — Hardware Scan & Model Download

```tsx
// Slide3Hardware.tsx

// ─── Phase 0: Check existing model (QUAN TRỌNG) ───────────────────────────────
// Khi slide được mount, kiểm tra xem đã có model được cấu hình chưa:
// 1. Gọi getLlmConfig() để lấy config hiện tại
// 2. Gọi getLlmProviderStatus() để check xem model đã load chưa
// 3. Gọi scanLocalLlmModels() để lấy danh sách GGUF đã có trên máy
//
// Nếu đã có config (local_model_path != null HOẶC provider != local):
//   → Hiển thị trạng thái "AI đã sẵn sàng" thay vì download flow
//   → Vẫn hiển thị danh sách model để user có thể đổi nếu muốn

// ─── Phase 1: Scanning (2–3 giây animation) ────────────────────────────────────
// - Hiển thị: CPU bar, RAM bar animation
// - Song song: gọi detectSystemSpecs() + getLlmConfig() + scanLocalLlmModels()
// - Lưu kết quả vào systemSpecsAtom, existingConfigAtom, localModelsAtom

// ─── Phase 2A: Đã có model (Happy Path) ────────────────────────────────────────
// Layout khi phát hiện model đang dùng:
// ┌─────────────────────────────────────────────┐
// │  ✅ AI đã được cấu hình sẵn               │
// │  Mô hình hiện tại:                          │
// │  ╔═══════════════════════════════════════╗  │
// │  ║ 🟢 Qwen2.5-3B (đang dùng) [2GB]     ║  │
// │  ╚═══════════════════════════════════════╝  │
// │                                             │
// │  Hoặc chọn mô hình khác bên dưới:          │
// │  ○ Llama-3.1-8B   [Tốt]   [4.9GB]         │
// │  ○ gemma-2-2b     [Tối ưu] [1.6GB]        │
// ├─────────────────────────────────────────────┤
// │  [Giữ nguyên & Tiếp theo]  [Đổi mô hình]  │
// └─────────────────────────────────────────────┘
//
// Nút "Giữ nguyên & Tiếp theo" → skip download, proceed to Slide 4
// Nút "Đổi mô hình" → mở rộng download flow (Phase 2B)

// ─── Phase 2B: Chưa có model / Muốn đổi (Download Flow) ────────────────────────
// Layout:
// ┌─────────────────────────────────────────┐
// │  🖥 Máy của bạn                         │
// │  CPU: Apple M3 (8 cores)                │
// │  RAM: 16 GB (12 GB khả dụng)            │
// ├─────────────────────────────────────────┤
// │  Mô hình được đề xuất:                  │
// │  ╔══════════════════════════════════╗   │
// │  ║ ⭐ Qwen2.5-3B  [Tối ưu] [2GB]  ║   │
// │  ╚══════════════════════════════════╝   │
// │  ○ Llama-3.1-8B  [Tốt]   [4.9GB]       │
// │  ○ gemma-2-2b    [Tối ưu] [1.6GB]      │
// ├─────────────────────────────────────────┤
// │  [⬇ Tải model đã chọn]  [Tải sau]      │
// └─────────────────────────────────────────┘
//
// - Nếu model đã được download sẵn (có trong scanLocalLlmModels):
//   → Nút hiện "Chọn & Tiếp theo" (không cần tải lại)
//   → Gọi saveLlmConfig với đường dẫn model sẵn có
// - Nếu chưa có:
//   → Nút "Tải xuống" → downloadLlmModel() + progress bar
//   → Sau khi tải xong: tự saveLlmConfig + loadLlmProvider
// - "Tải sau": skip, không thay đổi config hiện tại

// Notes:
// - Dùng lại CURATED_MODELS từ LLMModelSetting (extract ra shared file)
// - Filter qua getRecommendedModels(specs.available_ram_gb, role)
// - Model đã download (có trong localModels) hiển thị badge [✓ Đã tải]
// - Model đang active (match config.local_model_path) hiển thị badge [🟢 Đang dùng]
```

---

### PHẦN 11: Slide 4 — Workspace Setup

```tsx
// Slide4Workspace.tsx

// Components:
// 1. Folder picker:
//    - Button "Chọn thư mục làm việc" → gọi openFolderDialog() từ FileExplorer/api
//    - Hiển thị path đã chọn
//    - Có thể bỏ qua (optional)

// 2. Template checkbox (optional):
//    <Checkbox id="create-template" />
//    "Tự động tạo file Start.md và diagram mẫu trong thư mục"
//    → Nếu check: gọi write_file_content(path + "/Start.md", STARTER_TEMPLATE)

// 3. CTA button (lớn, nổi bật):
//    "🚀 Bắt đầu sử dụng Depdok"
//    onClick:
//      1. setOnboardingCompleted() → lưu store.json
//      2. Nếu có folder: openWorkspace(folderPath) → dispatch openWorkspaceAtom
//      3. navigate('/editor') hoặc navigate('/home')

// Starter template nội dung:
const STARTER_TEMPLATE = `# Bắt đầu với Depdok

Chào mừng! Đây là file hướng dẫn nhanh.

## Mermaid Diagram

\`\`\`mermaid
graph LR
    A[Tài liệu] --> B[Preview]
    B --> C[Export PDF]
\`\`\`

## Markdown Shortcuts

- **Bold**, *Italic*, \`Code\`
- Kéo file vào editor để mở
`;
```

---

### PHẦN 12: Skip Button & Navigation Logic

```tsx
// SkipButton.tsx
// Vị trí: góc phải màn hình onboarding, position fixed
// Chỉ hiển thị từ slide 1 trở đi

const handleSkip = async () => {
  await setOnboardingDismissed();
  navigate("/home", { replace: true });
};

// <Button variant="ghost" size="sm" onClick={handleSkip}>
//   Thiết lập sau →
// </Button>
```

**Điều hướng giữa slides:**
- Nút "Tiếp theo" → `setCurrentSlide(n + 1)`
- Nút "Quay lại" (từ slide 2 trở đi) → `setCurrentSlide(n - 1)`
- Slide 3: Nút "Tải sau trong Cài đặt" → skip download, vẫn tiếp tục slide 4
- Slide 4: "Bắt đầu" → hoàn thành

---

## 5. Danh Sách File Cần Tạo / Sửa

### [NEW] Files cần tạo

| File | Mô tả |
|------|-------|
| `src/api-client/onboarding.ts` | API wrapper: `detectSystemSpecs`, `getOnboardingState`, `setOnboardingCompleted`, `setOnboardingDismissed` |
| `src/features/Onboarding/index.ts` | Public exports |
| `src/features/Onboarding/types.ts` | Shared types: `CuratedModel`, `UserRole`, `RecommendedModel` |
| `src/features/Onboarding/store/OnboardingStore.ts` | Jotai atoms |
| `src/features/Onboarding/hooks/useOnboarding.ts` | Logic hook: specs fetch, download flow, navigation |
| `src/features/Onboarding/lib/modelRecommendations.ts` | Logic lọc model theo RAM + role |
| `src/features/Onboarding/lib/starterTemplate.ts` | STARTER_TEMPLATE constant |
| `src/features/Onboarding/components/OnboardingCarousel.tsx` | Carousel container với CSS transition |
| `src/features/Onboarding/components/SkipButton.tsx` | Fixed skip button |
| `src/features/Onboarding/components/ProgressDots.tsx` | 4 dots indicator |
| `src/features/Onboarding/components/slides/Slide1Welcome.tsx` | Welcome + Role cards |
| `src/features/Onboarding/components/slides/Slide2Demo.tsx` | Mini Mermaid live demo |
| `src/features/Onboarding/components/slides/Slide3Hardware.tsx` | Hardware scan + model download |
| `src/features/Onboarding/components/slides/Slide4Workspace.tsx` | Workspace setup |
| `src/features/Onboarding/components/hardware/HardwareScanAnimation.tsx` | Animated bars |
| `src/pages/Onboarding.tsx` | Page wrapper |

### [MODIFY] Files cần sửa

| File | Thay đổi |
|------|----------|
| `src/App.tsx` | Thêm `<Route path="/onboarding" element={<Onboarding />} />` |
| `src/pages/Checking.tsx` | Thêm logic check `onboarding_completed` / `onboarding_dismissed` |
| `src/features/LLMChat/settings/LLMModelSetting.tsx` | Extract `CURATED_MODELS` ra `src/features/Onboarding/types.ts` |
| `src-tauri/src/lib.rs` | Thêm `detect_system_specs` command + đăng ký invoke_handler |
| `src-tauri/Cargo.toml` | Thêm `sysinfo = "0.32"` |

---

## 6. Luồng Data Flow Slide 3 (Chi tiết)

```
User arrives at Slide 3
    │
    ▼
[useOnboarding hook — Phase 0: Parallel fetch]
    ├── detectSystemSpecs()       → systemSpecsAtom
    ├── getLlmConfig()            → existingConfigAtom
    ├── getLlmProviderStatus()    → existingStatusAtom
    └── scanLocalLlmModels()     → localModelsAtom
    │   isSpecsScanningAtom = true
    │   Show HardwareScanAnimation (2–3s)
    │   isSpecsScanningAtom = false
    │
    ▼
[Branch: existingConfig có local_model_path HOẶC provider != local?]
    │
    ├── YES → Phase 2A: "AI đã sẵn sàng"
    │         Hiển thị model đang dùng với badge [🟢 Đang dùng]
    │         Hiển thị các model khác để user có thể đổi
    │         Nút: [Giữ nguyên & Tiếp theo]  [Đổi mô hình]
    │         │
    │         ├── "Giữ nguyên" → KHÔNG thay đổi config
    │         │                  Proceed to Slide 4
    │         │
    │         └── "Đổi mô hình" → expand Phase 2B download UI
    │
    └── NO  → Phase 2B: Download flow
              getRecommendedModels(specs.available_ram_gb, selectedRole)
              │── Filter CURATED_MODELS
              │── Tag: "optimal" / "good" / "heavy"
              │── Sort: optimal + role match first
              │── Auto-select top model → selectedModelAtom
              │
              [User selects model]
              │
              ├── Model đã có trong localModels?
              │   YES → Nút "Chọn & Tiếp theo"
              │         saveLlmConfig({ local_model_path: existing_path })
              │         loadLlmProvider()
              │         Proceed to Slide 4
              │
              └── NO  → Nút "Tải xuống"
                        downloadLlmModel(url, filename) → progress bar
                        Khi xong:
                            saveLlmConfig({ local_model_path: ... })
                            loadLlmProvider()
                            toast.success("Model loaded!")
                        Proceed to Slide 4

"Tải sau" (available in both 2A and 2B):
    → Không thay đổi config hiện tại
    → Proceed to Slide 4

[Slide 4]
```

---

## 7. UX Details & Micro-animations

### Carousel Transition
```css
/* CSS transition giữa slides */
.slide-enter  { transform: translateX(100%); opacity: 0; }
.slide-active { transform: translateX(0);    opacity: 1; transition: all 400ms cubic-bezier(0.4, 0, 0.2, 1); }
.slide-exit   { transform: translateX(-100%); opacity: 0; }
```

### Hardware Scan Animation
- Dùng `framer-motion` (hoặc Tailwind `animate-pulse`) cho progress bars
- Các bars "quét" từng mục: CPU → RAM → Disk (mỗi mục delay 0.3s)
- Sau khi quét xong: hiện kết quả với `transition-opacity duration-500`

### Download Progress Bar
- Dùng lại component progress bar từ `LLMModelSetting.tsx` (lines 608-630)
- Thêm ETA estimate dựa trên speed (tính từ bytes downloaded / time elapsed)
- Format: `"Còn khoảng 2 phút... (1.2 MB/s)"`

---

## 8. Thiết Kế Visual (Design Tokens)

Onboarding sử dụng design system hiện tại (Tailwind + shadcn/ui):

```tsx
// Wrapper full screen:
<div className="fixed inset-0 bg-background flex items-center justify-center overflow-hidden">

// Slide container:
<div className="w-full max-w-4xl mx-auto h-[80vh] flex flex-col">

// Left-right split (slides 1, 3, 4):
<div className="grid grid-cols-2 gap-12 h-full items-center px-12">

// Accent color cho role cards và recommended badge:
// tag === "optimal" → "bg-primary/10 border-primary text-primary"
// tag === "good"    → "bg-muted border-border text-foreground"
```

---

## 9. Checklist Triển Khai (Ordered)

### Phase 1: Backend
- [ ] Thêm `sysinfo = "0.32"` vào `Cargo.toml`
- [ ] Thêm struct `SystemSpecs` + command `detect_system_specs()` vào `lib.rs`
- [ ] Đăng ký command trong `invoke_handler!([..., detect_system_specs, ...])`
- [ ] Build & test: `pnpm app-dev` — kiểm tra command trả về đúng RAM/CPU

### Phase 2: API Client & Store Logic
- [ ] Tạo `src/api-client/onboarding.ts` với các functions đọc/ghi `store.json`
- [ ] Update `src/pages/Checking.tsx`: thêm logic check onboarding state

### Phase 3: Routing
- [ ] Tạo `src/pages/Onboarding.tsx` (wrapper đơn giản, render `OnboardingCarousel`)
- [ ] Thêm route `/onboarding` vào `src/App.tsx` (ngoài `LayoutRoute`)

### Phase 4: Shared Types & Logic
- [ ] Extract `CURATED_MODELS` ra `src/features/Onboarding/types.ts`
- [ ] Update import trong `LLMModelSetting.tsx`
- [ ] Tạo `modelRecommendations.ts` với `getRecommendedModels()`
- [ ] Tạo `OnboardingStore.ts` với atoms

### Phase 5: Components (theo thứ tự)
- [ ] `SkipButton.tsx` — fixed positioned
- [ ] `ProgressDots.tsx` — 4 dots indicator
- [ ] `HardwareScanAnimation.tsx` — animated bars
- [ ] `Slide1Welcome.tsx` — role cards
- [ ] `Slide2Demo.tsx` — mermaid mini preview
- [ ] `Slide3Hardware.tsx` — scan + model list + download
- [ ] `Slide4Workspace.tsx` — folder + template + CTA
- [ ] `OnboardingCarousel.tsx` — assembly + transitions

### Phase 6: Hook
- [ ] `useOnboarding.ts` — orchestrate: specs fetch, download, save, navigate

### Phase 7: Integration Testing
- [ ] Test first launch → redirect `/onboarding`
- [ ] Test Skip → `onboarding_dismissed: true` → redirect `/home` on next launch
- [ ] Test Complete → `onboarding_completed: true` → redirect `/home` on next launch
- [ ] Test Download flow trong Slide 3 (progress bar, success toast, config saved)
- [ ] Test Workspace selection → openWorkspace → navigate editor
- [ ] Test model tự động load sau khi download (liveLlmProvider call)

---

## 10. Rủi Ro & Giải Pháp

| Rủi ro | Giải pháp |
|--------|-----------|
| `sysinfo` tăng bundle size Rust đáng kể | Dùng `features = ["component"]` để chỉ include phần cần |
| User tải model nhưng app crash do OOM | Hiển thị warning nếu `model.sizGb * 1.5 > available_ram_gb` |
| Slide 2 Mermaid không render nếu `mermaid.js` chưa init | Gọi `mermaid.initialize()` trong `useEffect` của Slide2Demo |
| Windows path issues khi save config | Dùng `write_file_content` qua Rust wrapper, không dùng `plugin-fs` trực tiếp |
| User click Back trên browser / OS gesture | Dùng `replace: true` trong navigate để không stack history |
| Model list outdated khi có model mới | `CURATED_MODELS` nên được maintain theo version; xem xét fetch từ remote JSON trong tương lai |
