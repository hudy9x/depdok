# Kế hoạch Nâng cấp 1: 1-Click LLM Onboarding & Model Download (Hugging Face API Integration)
**Mã tài liệu:** `docs/plan/1-llm-onboarding.md`  
**Mục tiêu:** Đơn giản hóa quá trình cài đặt mô hình ngôn ngữ lớn (LLM) và nhúng (Embedding) cục bộ từ phức tạp thành trải nghiệm 1-click, sử dụng trực tiếp Hugging Face API để truy vấn thông tin mô hình động.  
**Tài liệu tham chiếu:** [Đề xuất Cải tiến & GTM](file:///Users/hudy/ws/depdok/docs/marketing/product_improvements.md)

---

## 1. Vấn đề Hiện tại
*   Người dùng mới phải tự tìm hiểu cấu hình phần cứng, tải thủ công mô hình GGUF và thiết lập đường dẫn trên ổ đĩa.
*   Danh sách mô hình hiện tại được hardcode trong code. Khi có phiên bản mô hình mới (ví dụ từ Gemma 2 sang Gemma 4), lập trình viên phải sửa code và phát hành phiên bản app mới để cập nhật link tải.
*   Nếu máy bị thiếu RAM/VRAM hoặc người dùng chọn nhầm model quá nặng so với khả năng xử lý của máy, ứng dụng sẽ bị đơ hoặc crash không rõ lý do.
*   Thanh tiến trình tải model còn đơn giản, thiếu thông tin về tốc độ tải và dung lượng ổ đĩa khả dụng.

---

## 2. Giải pháp Kỹ thuật & UI/UX

### A. Nhận diện Phần cứng & Truy vấn Hugging Face API
*   **Bước 1: Quét cấu hình máy (Local Specs):**
    *   Sử dụng thư viện Rust `sysinfo` để lấy thông số RAM trống và VRAM khả dụng của card đồ họa.
    *   *Quy tắc ước lượng:* Một mô hình cần dung lượng RAM tối thiểu lớn hơn kích thước file GGUF khoảng 2GB (phục vụ overhead hệ thống và context window).
*   **Bước 2: Truy vấn Hugging Face API động:**
    *   Thay vì hardcode URL tải trực tiếp, ứng dụng sẽ gọi API của Hugging Face:
        `GET https://huggingface.co/api/models/{repo_id}` (ví dụ: `unsloth/Qwen3.5-4B-GGUF`).
    *   API trả về danh sách các file GGUF hiện có trong repository cùng dung lượng chính xác (`size` tính bằng byte) và tag cấu hình.
*   **Bước 3: Công cụ Đề xuất động (Dynamic Recommendation Engine):**
    *   Bộ lọc ở frontend/backend sẽ so khớp thông số RAM khả dụng với kích thước file được trả về từ Hugging Face API.
    *   App sẽ tự động chọn và đề xuất file quantization phù hợp nhất (ví dụ: khuyên dùng bản `Q4_K_M` hoặc `Q5_K_M` thay vì cố tải bản `Q8_K_L` nếu RAM < 16GB).

### B. Trình tải Mô hình Thông minh (Smart Download Dashboard)
*   **Thông tin trực quan:** Bổ sung hiển thị Tốc độ tải (MB/s), Thời gian còn lại dự kiến (ETA), và kiểm tra dung lượng trống của ổ đĩa trước khi tải để tránh lỗi đầy bộ nhớ giữa chừng.
*   **Khả năng Resume:** Tận dụng backend Rust với thư viện `reqwest` hỗ trợ `Range` header để tiếp tục tải từ điểm dừng nếu mất mạng, tránh bắt đầu lại từ 0.

### C. Đơn giản hóa Giao diện Cài đặt (UI Settings)
*   Thiết kế lại tab **Local LLM** với nút bật lớn **"Auto-configure AI Settings"** (Bật mặc định).
*   Ứng dụng sẽ hiển thị danh sách các model hot lấy từ Hugging Face API kèm theo tag phân loại: `[Khuyên Dùng Cho Máy Của Bạn]`, `[Yêu Cầu RAM Cao]`, `[Tối Ưu Cho Viết Code]`.

---

## 3. Danh sách Công việc (Checklist Triển khai)

- [ ] **Tạo API Backend Rust:**
  - Viết Tauri command `detect_system_specs()` trả về JSON chứa RAM, GPU, OS, dung lượng ổ đĩa khả dụng.
  - Viết module HTTP client gọi đến Hugging Face API để lấy thông tin metadata của repository mô hình cụ thể.
  - Cải tiến hàm tải GGUF hỗ trợ kiểm tra dung lượng trống trước khi thực hiện tải.
- [ ] **Thiết kế UI/UX trên React:**
  - Thiết kế màn hình chào mừng Onboarding (Welcome Flow) khi mở app lần đầu nếu chưa cài đặt AI.
  - Tích hợp gọi Hugging Face API từ client để hiển thị danh sách file GGUF hiện có của các model được quản trị kèm dung lượng thật.
  - Thêm thẻ hiển thị thông số phần cứng thiết bị của người dùng để họ hiểu lý do đề xuất model.
- [ ] **Tích hợp & Kiểm thử:**
  - Mô phỏng tải ngắt quãng (Network Interruption) để kiểm tra khả năng tiếp tục tải (resume).
  - Đảm bảo app không bị crash nếu người dùng huỷ tải giữa chừng (Cancel Download).

