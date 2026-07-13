# Kế hoạch Nâng cấp 3: Tối ưu & Nâng cấp Sơ đồ Offline
**Mã tài liệu:** `docs/plan/3-diagram-offline-upgrade.md`  
**Mục tiêu:** Mở rộng năng lực hiển thị offline của PlantUML và Mermaid, bổ sung cơ chế kiểm soát an toàn bảo mật khi gửi dữ liệu và tối ưu hiệu năng render sơ đồ lớn.  
**Tài liệu tham chiếu:** [Đề xuất Cải tiến & GTM](file:///Users/hudy/ws/depdok/docs/marketing/product_improvements.md)

---

## 1. Vấn đề Hiện tại
*   Cả `beautiful-plantuml` và `beautiful-mermaid` (engine offline chạy client-side) hầu như chỉ hỗ trợ Sequence Diagram. Khi người dùng viết các sơ đồ dạng khác (Flowchart, Class, State), hệ thống sẽ bị lỗi hiển thị hoặc tự động gửi dữ liệu ra server online (PlantUML server) mà không cảnh báo.
*   Mermaid render lại sơ đồ trong thời gian thực khi gõ phím. Với các sơ đồ lớn, việc này làm UI thread bị chặn (blocking), gây giật lag nghiêm trọng trong quá trình soạn thảo văn bản.

---

## 2. Giải pháp Kỹ thuật & UI/UX

### A. Cảnh báo Bảo mật Dữ liệu (Online Fallback Guard)
*   **Kiểm tra tính hợp lệ của sơ đồ offline:** Viết một bộ parser/checker nhanh bằng regex ở frontend trước khi vẽ sơ đồ.
*   **Hộp thoại Cảnh báo (Security Dialog):** Nếu sơ đồ không thể dịch offline và hệ thống chuẩn bị gửi dữ liệu lên server ngoài (`https://img.plantuml.biz`), app sẽ hiển thị một thông báo xác nhận:
    *   *Tiêu đề:* "Cảnh báo Bảo mật: Sơ đồ yêu cầu kết nối trực tuyến"
    *   *Nội dung:* "Sơ đồ này vượt quá khả năng xử lý offline. Để hiển thị, dữ liệu sơ đồ sẽ được mã hóa và gửi tới máy chủ PlantUML bên thứ ba. Bạn có đồng ý gửi dữ liệu này đi không?"
    *   *Lựa chọn:* `[Đồng ý gửi]`, `[Chỉ hiển thị Text thô]`, và tuỳ chọn `[Ghi nhớ lựa chọn cho dự án này]`.

### B. Trì hoãn & Chạy nền Tác vụ vẽ (Debounced & Async Render)
*   **Debounce Rendering:** Thiết lập độ trễ (ví dụ: 400ms) sau khi người dùng dừng gõ phím mới kích hoạt tiến trình render lại sơ đồ. Điều này tránh việc Mermaid/PlantUML cố gắng chạy SVG parser liên tục trên từng phím gõ.
*   **Web Worker:** Đưa các tác vụ parse text sơ đồ phức tạp của Mermaid/PlantUML ra ngoài luồng chính (Main UI Thread) bằng cách chạy chúng trong Web Worker. Luồng chính chỉ nhận về mã SVG hoàn chỉnh để vẽ lên màn hình.

### C. Mở rộng Parser Offline cho Flowcharts
*   Nâng cấp thư viện `beautiful-mermaid` để hỗ trợ hiển thị sơ đồ **Flowchart** (Lưu đồ hình khối). Đây là loại sơ đồ có tần suất sử dụng cao nhất của lập trình viên, việc mở rộng tính năng Click-to-jump (Click vào khối nhảy tới code) lên Flowchart sẽ tăng 200% trải nghiệm sản phẩm.

---

## 3. Danh sách Công việc (Checklist Triển khai)

- [ ] **Xây dựng Security Guard:**
  - Triển khai hộp thoại cảnh báo `PlantUMLOnlineWarningDialog` bằng Radix UI.
  - Lưu trạng thái cho phép/từ chối gửi dữ liệu online vào store cấu hình của dự án.
- [ ] **Tối ưu hóa Hiệu năng Render:**
  - Viết custom React hook `useDebouncedRender` để bọc các hàm cập nhật nội dung sơ đồ trong preview.
  - Cấu hình Web Worker cho Mermaid SVG Compiler.
- [ ] **Mở rộng AST Parser:**
  - Phát triển bộ phân tích cú pháp AST cho Mermaid Flowchart để thu thập toạ độ các khối và ánh xạ dòng code (line number mappings).
  - Tích hợp khả năng click-to-jump cho các phần tử hình khối của Flowchart.
- [ ] **Kiểm thử hiệu năng:**
  - Tạo các file chứa 10+ sơ đồ Mermaid Flowchart lớn và kiểm tra độ mượt khi soạn thảo văn bản.
