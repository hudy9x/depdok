# Kế hoạch Nâng cấp 2: Unified Hybrid WYSIWYG Editor
**Mã tài liệu:** `docs/plan/2-markdown-editor-hybrid.md`  
**Mục tiêu:** Loại bỏ sự phân mảnh giữa hai chế độ soạn thảo (Code & Preview) bằng cách tích hợp chúng vào một trình soạn thảo lai Hybrid WYSIWYG duy nhất (tương tự như Typora hay Obsidian Live Preview), nâng cấp parser để triệt tiêu việc mất định dạng Markdown.  
**Tài liệu tham chiếu:** [Báo cáo Đánh giá Sản phẩm (Feature Roast)](file:///Users/hudy/ws/depdok/docs/marketing/feature_roast.md)

---

## 1. Vấn đề Hiện tại
*   Người dùng phải chia đôi màn hình (Split-pane) giữa Monaco Editor (Raw text) và TipTap (Preview) hoặc chuyển tab qua lại. Việc này chiếm dụng không gian làm việc và tốn tài nguyên render song song.
*   Khi đồng bộ cuộn (scroll-sync) giữa hai trình soạn thảo độc lập, do sự chênh lệch chiều cao của các phần tử ảnh/sơ đồ nên thường xảy ra hiện tượng lệch dòng và trễ hình (jittering).
*   Chuyển đổi qua lại giữa TipTap (HTML/JSON) và Monaco (Raw Markdown) gây mất Frontmatter, mất các thẻ comment ẩn `<!-- comment -->`, các thuộc tính bảng nâng cao hoặc các tag HTML nhúng.

---

## 2. Giải pháp Kỹ thuật & UI/UX

### A. Thiết lập Trình soạn thảo Lai (Hybrid Editor) dựa trên TipTap
*   **Editor chính làm gốc:** Sử dụng **TipTap** làm không gian viết chính, loại bỏ việc chia đôi màn hình mặc định.
*   **Markdown Syntax Auto-Render:** Sử dụng hoặc tùy biến plugin `@tiptap/extension-markdown` để tự động render các cú pháp Markdown sang WYSIWYG khi dòng đó mất focus (blur) và hiển thị lại mã nguồn thô khi người dùng click con trỏ chuột vào dòng đó để sửa:
    *   *Ví dụ:* Khi không sửa, hiển thị tiêu đề lớn **Tiêu đề 1**. Khi đặt con trỏ chuột vào tiêu đề đó, nó tự động đổi thành `# Tiêu đề 1` dạng text thô.
*   **Monaco làm Editor dự phòng (Raw Code Mode):** Vẫn giữ Monaco làm một chế độ xem "Raw Code" độc lập. Chế độ này chỉ được bật thủ công qua thanh công cụ khi người dùng cần can thiệp sâu vào cấu trúc file, không render song song cùng lúc.

### B. Nâng cấp Parser Markdown ↔ HTML/JSON
*   **Bảo toàn Frontmatter:** Viết thêm bộ lọc regex hoặc bộ tiền xử lý (pre-processor) để trích xuất phần Frontmatter ở đầu file Markdown (nằm giữa `---` và `---`) trước khi chuyển đổi nội dung cho TipTap render. Phần Frontmatter này sẽ được lưu trữ riêng biệt và tự động ghép nối lại nguyên vẹn khi lưu file.
*   **Cách ly Comment ẩn và HTML Blocks:** Sử dụng các Node tuỳ biến (Custom Nodes) trong TipTap để bọc các khối mã HTML hoặc comment tag ẩn, giữ nguyên vẹn chuỗi gốc của chúng mà không cố gắng chuyển đổi hay format lại.

---

## 3. Danh sách Công việc (Checklist Triển khai)

- [ ] **Nâng cấp TipTap Node & Extensions:**
  - Tích hợp và cấu hình chế độ Hybrid Render trên TipTap.
  - Xây dựng Custom Node cho Frontmatter để tránh hiển thị nó như văn bản thường trong WYSIWYG.
  - Xây dựng Custom Node cho các thẻ comment ẩn.
- [ ] **Đồng bộ hóa Save Handler:**
  - Cải tiến hàm parse trong `src/features/Editor/EditorSaveHandler.tsx` để bảo toàn cấu trúc raw text nguyên bản 100%.
- [ ] **Thiết kế lại Layout Workspace:**
  - Bỏ thiết kế chia đôi màn hình mặc định. Thay thế bằng nút gạt chuyển đổi đơn giản: `[ Soạn Thảo (WYSIWYG) | Xem Mã Nguồn (Monaco) ]`.
- [ ] **Kiểm thử hồi quy:**
  - Mở các tài liệu Markdown lớn có cấu trúc phức tạp (nhiều bảng, frontmatter, code blocks) để kiểm tra xem khi lưu lại có bị thay đổi ký tự nào ngoài mong muốn không.
