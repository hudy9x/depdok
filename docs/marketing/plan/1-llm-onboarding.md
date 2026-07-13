# Kế hoạch Nâng cấp 1: 1-Click LLM Onboarding & Model Download (Hugging Face API Integration)
**Mã tài liệu:** `docs/plan/1-llm-onboarding.md`  
**Mục tiêu:** Đơn giản hóa quá trình cài đặt mô hình ngôn ngữ lớn (LLM) và nhúng (Embedding) cục bộ từ phức tạp thành trải nghiệm 1-click, sử dụng trực tiếp Hugging Face API để truy vấn thông tin mô hình động.  
**Tài liệu tham chiếu:** [Đề xuất Cải tiến & GTM](file:///Users/hudy/ws/depdok/docs/marketing/3-product_improvements.md)

---

## 1. Vấn đề Hiện tại
*   Người dùng mới phải tự tìm hiểu cấu hình phần cứng, tải thủ công mô hình GGUF và thiết lập đường dẫn trên ổ đĩa.
*   Danh sách mô hình hiện tại được hardcode trong code. Khi có phiên bản mô hình mới (ví dụ từ Gemma 2 sang Gemma 4), lập trình viên phải sửa code và phát hành phiên bản app mới để cập nhật link tải.
*   Nếu máy bị thiếu RAM/VRAM hoặc người dùng chọn nhầm model quá nặng so với khả năng xử lý của máy, ứng dụng sẽ bị đơ hoặc crash không rõ lý do.
*   Chưa có màn hình Onboarding tập trung hướng dẫn người dùng thiết lập môi trường trong lần đầu tiên mở ứng dụng.

---

## 2. Giải pháp Kỹ thuật & UI/UX

### A. Cơ chế Bỏ qua & Lưu Trạng thái (Skip Mechanism & Tauri Store)
*   **Không ép buộc người dùng:** Thêm nút **"Skip Setup"** (hoặc "Thiết lập sau") nổi bật ở góc trên bên phải của màn hình Onboarding.
*   **Logic Điều phối Trạng thái:**
    *   Sử dụng `@tauri-apps/plugin-store` để ghi nhận hai cờ độc lập vào `store.json`:
        *   `onboarding_completed: true` (Hoàn thành tải AI và cấu hình).
        *   `onboarding_dismissed: true` (Người dùng chủ động bỏ qua hoặc hoãn cài đặt).
    *   **Khởi động App:** Hệ thống sẽ kiểm tra:
        *   Nếu `onboarding_completed === true` HOẶC `onboarding_dismissed === true` -> Chuyển hướng thẳng vào `/editor` hoặc `/home`.
        *   Nếu cả hai đều là `false` -> Chuyển hướng người dùng vào màn hình `/onboarding`.
    *   *Mục tiêu:* Đảm bảo chỉ hiển thị Onboarding một lần duy nhất lúc mở app lần đầu, người dùng có quyền bỏ qua ngay lập tức để trải nghiệm sản phẩm thủ công.

### B. Giải đáp về khóa API Hugging Face (Hugging Face API Key)
*   > [!NOTE]
    > **Hugging Face API hoàn toàn miễn phí và KHÔNG yêu cầu API Key** đối với các tác vụ đọc thông tin công khai (như liệt kê file, lấy dung lượng và tải các model GGUF công cộng). Người dùng có thể Onboarding ngay lập tức mà không cần đăng ký tài khoản hay tạo API Key.

### C. Thiết kế Giao diện Trượt Xen kẽ (Sliding Carousel UX)
Ứng dụng sẽ sử dụng một cấu trúc **Trượt Slide (Sliding Carousel)** mượt mà, phân chia tiến trình onboarding thành 4 slides kết hợp giữa cài đặt (setup) và trải nghiệm thử (live demo):

```
[ Slide 1: Welcome & Role ] ──► [ Slide 2: Live Demo ] ──► [ Slide 3: Hardware & AI ] ──► [ Slide 4: Workspace ]
(Cài đặt: Chọn vai trò)       (Trải nghiệm: Click sơ đồ)   (Cài đặt: Tải model HF)      (Cài đặt: Chọn folder)
```

#### 🛠 Chi tiết các Slide:

#### **Slide 1: Welcome & Chọn Vai Trò (Setup & Info)**
*   **Trái:** Lời chào mừng và câu hỏi khảo sát ngắn để cấu hình nhanh:
    *   *"Vai trò chính của bạn trong dự án là gì?"*
        *   `[ ] Software Architect` (Tự động thiết lập Prompts hệ thống tối ưu cho thiết kế hệ thống, sơ đồ C4).
        *   `[ ] Technical Writer / DevRel` (Tối ưu hóa các mẫu template Markdown, preview xuất bản).
        *   `[ ] Security Enthusiast` (Tắt kết nối mạng ngoài, ưu tiên model local tối đa).
*   **Phải:** Hình ảnh minh họa chuyển động mô tả kiến trúc cốt lõi của `depdok`.

#### **Slide 2: Trải nghiệm thực tế "Aha!" Moment (Live Demo)**
*   **Trực quan:** Hiển thị một khung soạn thảo thu nhỏ hoạt động trực tiếp.
    *   Trái là mã nguồn Markdown sơ đồ Mermaid đơn giản.
    *   Phải là sơ đồ sequence diagram đã được render trực quan.
*   **Tương tác:** Yêu cầu người dùng: *"Hãy click thử vào một actor/box trên sơ đồ bên phải để xem dòng code tương ứng được highlight bên trái"*.
*   *Mục tiêu:* Tạo ấn tượng mạnh về tính năng độc bản của app trước khi chuyển sang bước tải nặng.

#### **Slide 3: Quét phần cứng & Đề xuất AI (Setup & Download)**
*   **Quét thiết bị (Hardware Scan):** Hiển thị hoạt họa (micro-animation) hệ thống đang kiểm tra RAM, Chip và GPU thực tế.
*   **Đề xuất thông minh:** Gọi Hugging Face API động để hiển thị danh sách file GGUF hiện tại của model được chọn, khớp với RAM trống:
    *   *Khuyên dùng:* Gắn tag lá cờ `[Tối ưu cho máy của bạn]` lên bản GGUF thích hợp (ví dụ: Qwen-2.5-Coder-1.5B cho RAM thấp, Llama-3-8B cho RAM trung bình).
*   **Hành động:** Nút bấm `[Tải xuống mô hình]` kèm thanh phần trăm chi tiết (ETA, tốc độ tải) HOẶC nút `[Tải sau trong Cài đặt]` để bỏ qua bước này.

#### **Slide 4: Không gian làm việc đầu tiên (Setup Workspace)**
*   **Chọn thư mục:** Cho phép người dùng chọn một folder cục bộ để bắt đầu làm việc.
*   **Tạo Template:** Checkbox tuỳ chọn *"Tự động tạo file hướng dẫn Start.md và sơ đồ mẫu"* để họ có tài liệu đọc thử ngay lập tức.
*   **Hành động:** Nút bấm lớn **"Bắt đầu sử dụng depdok"** sẽ lưu cờ `onboarding_completed: true` và đưa người dùng vào editor chính.

---

## 3. Danh sách Công việc (Checklist Triển khai)

- [ ] **Tạo API Backend Rust:**
  - Viết Tauri command `detect_system_specs()` để trả về cấu hình chi tiết của máy người dùng.
  - Tích hợp cấu trúc lưu trữ `onboarding_dismissed` và `onboarding_completed` vào Tauri Store.
- [ ] **Thiết kế Định tuyến & Layout Carousel trên React:**
  - Tạo route `/onboarding` trong React Router.
  - Xây dựng component `OnboardingCarousel` hỗ trợ trượt mượt mà giữa các slide (sử dụng Tailwind transition và phím điều hướng).
  - Thêm nút **"Skip Setup"** ở góc trên bên phải để ghi cờ `onboarding_dismissed: true` và chuyển thẳng về `/home`.
- [ ] **Tích hợp demo tương tác (Slide 2):**
  - Nhúng một instance mini của Monaco + Mermaid node view chạy độc lập trong slide để người dùng thử bấm tương tác.
- [ ] **Tích hợp Hugging Face API (Slide 3):**
  - Viết hàm fetch danh sách file từ Hugging Face API mà không dùng API Key.
  - So khớp dung lượng file với RAM khả dụng để hiển thị đề xuất thông minh.
- [ ] **Kiểm thử tích hợp:**
  - Xác thực việc bấm "Skip Setup" lưu đúng cờ và không hiển thị lại màn hình onboarding ở các lần khởi chạy sau.
