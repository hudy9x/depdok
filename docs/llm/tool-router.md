# Kế hoạch Triển khai: Fast Triage Độc Lập bằng Main Model cho LLM2

## 1. Mục tiêu
Tối ưu hóa triệt để chi phí token và độ trễ của LLM2:
- **Tiết kiệm token tối đa:** Giảm lượng prompt tokens từ ~4.500 tokens xuống còn ~280 tokens đối với các câu hỏi thường (chitchat, giải thích code, dịch thuật, lý thuyết).
- **Phân loại đồng nhất & Đa ngôn ngữ (100% LLM-driven):** Loại bỏ hoàn toàn các bước Heuristic hay Structural Short-circuit thủ công. Mọi tin nhắn tự nhiên của người dùng đều đi thẳng qua Fast Triage bằng chính mô hình `qwen3.5:4b`.
- **Cơ chế An toàn (Fail-Safe):** Nếu phân loại ra `ALL` hoặc kết quả mơ hồ, tự động nạp đầy đủ công cụ để không bao giờ làm gián đoạn công việc của người dùng.
- **Dọn dẹp mã nguồn:** Gỡ bỏ 5 công cụ thử nghiệm cũ (`sum_four_digits`, `get_user_*`) và rút gọn các mô tả schema.

---

## 2. Kiến trúc Luồng Xử Lý (ASCII Diagram)

```text
User Message (Bất kỳ ngôn ngữ nào: Việt, Anh, Nhật, Hàn...)
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Fast Triage bằng Main Model (qwen3.5:4b)                │
│ - Request non-streaming siêu nhẹ (max_tokens: 5, temp: 0)   │
│ - Context ~80 tokens: Phân loại ý định ra đúng 1 nhãn:      │
│   [NONE | FILE | KNOWLEDGE | SHELL | SPREADSHEET | ALL]     │
│ - Thời gian phản hồi: ~100ms - 200ms                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
[Kết quả: NONE]             [Kết quả: Cần Tool hoặc ALL]
┌─────────────────────────┐ ┌─────────────────────────────────┐
│ Pure Chat Mode:         │ │ Scoped Tool Mode:               │
│ - tools: None           │ │ - tools: Chỉ nạp 3-5 tools      │
│   (0 token schema!)     │ │   của đúng Toolset được chọn    │
│ - System prompt gọn nhẹ │ │ - System prompt chỉ kèm rules   │
│   (~150 tokens)         │ │   của nhóm công cụ đó           │
└────────┬────────────────┘ └──────────────┬──────────────────┘
         │                                 │
         └────────────────┬────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Main Stream Response (qwen3.5:4b)                        │
│ - Prefill cực nhanh, bắt đầu stream tức thì                 │
│ - Tổng token tiêu thụ: ~280 tokens (tiết kiệm ~94%)         │
└─────────────────────────────────────────────────────────────┘
```

> **Lưu ý ngoại lệ duy nhất:** Nếu Frontend truyền danh sách `allowed_tools` cụ thể do người dùng chủ động chọn một **Skill / Slash Command** (`/skill-name`), Backend sẽ tôn trọng lựa chọn này và bỏ qua bước Triage.

---

## 3. Thiết kế Chi tiết Kỹ Thuật

### Bước 1: Fast Triage Prompt (Chạy trên `qwen3.5:4b`)
Gọi trực tiếp endpoint `/api/chat` của Ollama với cấu hình tối thiểu:
- `stream: false`
- `options: { "temperature": 0.0, "num_predict": 5 }`
- **Prompt:**
  ```text
  You are an intent classifier. Categorize the user request into ONE label:
  - NONE: General questions, chat, coding explanation, translation, math, rewriting.
  - FILE: Creating, reading, editing, listing local files/folders.
  - KNOWLEDGE: Searching workspace documentation or notes.
  - SHELL: Running terminal, bash, git, or command-line tools.
  - SPREADSHEET: Excel/CSV data, cells, formulas.
  - ALL: Multiple tools needed or ambiguous.

  Request: "{user_prompt}"
  Label:
  ```
- **Xử lý nhãn trả về:**
  - `NONE` $\rightarrow$ `tools: None` (Pure Chat)
  - `FILE` $\rightarrow$ `Toolset::FileSystem`
  - `KNOWLEDGE` $\rightarrow$ `Toolset::Knowledge`
  - `SHELL` $\rightarrow$ `Toolset::Execution`
  - `SPREADSHEET` $\rightarrow$ `Toolset::Spreadsheet`
  - `ALL` hoặc nhãn lạ $\rightarrow$ Nạp toàn bộ standard tools (Fail-Safe).

### Bước 2: Tinh gọn System Prompt theo Active Toolset
Hàm `build_system_prompt` sẽ lắp ghép các section có điều kiện:
- **Nếu `active_toolsets.is_empty()` (Pure Chat):**
  - Chỉ bao gồm `PROMPT_IDENTITY` và quy tắc định dạng Markdown.
  - Kích thước System Prompt giảm từ ~1.500 tokens xuống còn ~150 tokens.
- **Nếu có toolset hoạt động:**
  - Chỉ chèn các quy tắc hướng dẫn của nhóm toolset được chọn (ví dụ: chỉ chèn rule shell nếu nhãn là `SHELL`).

### Bước 3: Dọn dẹp Schema
- Loại bỏ 5 dummy tools trong `src-tauri/src/llm2/tools/schemas.rs`: `sum_four_digits`, `get_user_name`, `get_user_age`, `get_user_country`, `get_user_dob`.
- Rút gọn các `description` dài dòng trong từng schema.

---

## 4. Danh Sách File Cần Chỉnh Sửa & Thêm Mới

### Backend (Rust):
1. **[NEW] `src-tauri/src/llm2/router/toolsets.rs`**:
   - Enum `Toolset` (`FileSystem`, `Knowledge`, `Execution`, `Spreadsheet`, `WebSearch`, `Content`, `Skills`).
   - Hàm `tool_names()` và `expand_toolsets()`.
2. **[NEW] `src-tauri/src/llm2/router/classifier.rs`**:
   - `fast_triage_with_model(client: &reqwest::Client, model: &str, prompt: &str) -> Vec<Toolset>`:
     - Gửi prompt phân loại tới Ollama và parse nhãn trả về thành các `Toolset`.
3. **[NEW] `src-tauri/src/llm2/router/mod.rs`**:
   - `resolve_active_tools(prompt: &str, allowed_tools_override: Option<&[String]>, client: &reqwest::Client, model: &str) -> (Option<Vec<String>>, Vec<Toolset>)`.
4. **[MODIFY] `src-tauri/src/llm2/mod.rs`**:
   - Khai báo `pub mod router;`.
5. **[MODIFY] `src-tauri/src/llm2/tools/schemas.rs`**:
   - Xoá bỏ 5 dummy tools.
6. **[MODIFY] `src-tauri/src/llm2/context/system_prompt.rs` & `context/mod.rs`**:
   - Hỗ trợ xây dựng System Prompt linh hoạt theo danh sách `active_toolsets`.
7. **[MODIFY] `src-tauri/src/llm2/agent.rs`**:
   - Gọi router ở đầu hàm `run_agent_prompt` để lấy danh sách tools và toolsets trước khi gọi Ollama.

### Frontend (React/TypeScript):
8. **[MODIFY] `src/features/LLMChat2/components/LLMChat2Panel.tsx`**:
   - Khi không dùng Skill, gửi `allowed_tools: undefined` để Backend Router tự động tối ưu hóa.
   - Khi người dùng chọn Skill cụ thể, vẫn truyền đúng mảng tools của Skill đó.

---

## 5. Verification Plan (Kế hoạch Kiểm thử)

### Automated Checks:
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `pnpm build`

### Scenarios Kiểm thử:
1. **Chat thường (Tiếng Việt & Tiếng Anh):**
   - *"Giải thích mô hình MVC"* / *"Explain binary search tree"*
   - Kiểm tra log backend: Fast Triage trả về `NONE`. Request chính gửi `tools: None`. Bắt đầu stream ngay lập tức (<0.3s).
2. **File Operations (Tiếng Việt, Tiếng Anh, Tiếng Nhật):**
   - *"Tạo một file notes.md và ghi tóm tắt vào đó"*
   - *"Read content of @notes.md"*
   - *"ファイルを作成してください"*
   - Kiểm tra log backend: Fast Triage trả về `FILE`. Chỉ 5-6 tool File được nạp.
3. **Terminal / Shell:**
   - *"Chạy lệnh git status"*
   - Kiểm tra log backend: Fast Triage trả về `SHELL`. Chỉ nạp `run_shell`.
4. **Ambiguous / Phức tạp:**
   - Câu hỏi mơ hồ hoặc đòi hỏi nhiều bước: Triage trả về `ALL` hoặc fallback nạp full tools để đảm bảo an toàn.
