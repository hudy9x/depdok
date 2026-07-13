# Kế hoạch Nâng cấp 2: Unified Hybrid WYSIWYG Editor & HTML Table Integration
**Mã tài liệu:** `docs/plan/2-markdown-editor-hybrid.md`  
**Mục tiêu:** Loại bỏ hoàn toàn chế độ hiển thị song song (Side-by-Side), thiết lập trình soạn thảo lai WYSIWYG Hybrid một màn hình duy nhất, và nâng cấp cơ chế lưu trữ bảng (Table) dưới dạng thẻ HTML trong file Markdown để hỗ trợ các tính năng nâng cao (merge cell, cell highlight, background coloring).  
**Tài liệu tham chiếu:** [Báo cáo Đánh giá Sản phẩm (Feature Roast)](file:///Users/hudy/ws/depdok/docs/marketing/2-feature_roast.md)

---

## 1. Vấn đề Hiện tại
*   **Chia đôi màn hình (Side-by-Side) cồng kềnh:** Chế độ hiển thị song song giữa Monaco (Raw) và TipTap (Preview) chiếm diện tích lớn, gây lag do phải đồng bộ cuộn (scroll-sync) và render hai trình soạn thảo phức tạp cùng lúc.
*   **Hạn chế của Bảng Markdown tiêu chuẩn:** Cú pháp bảng mặc định của Markdown (`| cột | cột |`) cực kỳ nghèo nàn. Nó không hỗ trợ việc gộp ô (Merge cells - rowspan/colspan), chỉnh sửa chiều rộng cụ thể của từng cột, hoặc tô màu nền (background highlight) cho ô/hàng để làm nổi bật thông tin.

---

## 2. Giải pháp Kỹ thuật & UI/UX

### A. Loại bỏ Hoàn toàn Chế độ Side-by-Side (Single-Pane Editor)
*   **Không chia đôi màn hình:** Giao diện soạn thảo sẽ luôn hoạt động trên một vùng hiển thị (Viewport) duy nhất.
*   **Cơ chế Chuyển đổi Trực quan (View Mode Toggle):**
    *   Chế độ mặc định là **WYSIWYG Hybrid** (dựa trên TipTap): Người dùng viết và xem định dạng trực quan trực tiếp. Các cú pháp như in đậm, in nghiêng, tiêu đề, danh sách sẽ tự động render tại chỗ.
    *   Chế độ **Raw Code** (dựa trên Monaco): Khi cần chỉnh sửa mã nguồn sâu hoặc cấu trúc thô, người dùng bấm nút chuyển đổi trên thanh công cụ để tải Monaco Editor độc lập chiếm toàn màn hình. Không có sự đồng bộ cuộn hay render chạy song song.

### B. Lưu trữ Bảng (Table) Dưới Dạng Thẻ HTML
Thay vì cố gắng dịch các bảng phức tạp của TipTap về định dạng ống (`|`) của Markdown tiêu chuẩn khi lưu file, `depdok` sẽ serialize bảng trực tiếp thành thẻ HTML lồng nhau.
*   **Định dạng lưu trữ:** Bảng sẽ được lưu dưới dạng block HTML gốc ngay trong file `.md`:
    ```html
    <table>
      <thead>
        <tr>
          <th style="background-color: #f3f4f6; text-align: left;">Tiêu đề 1</th>
          <th colspan="2" style="background-color: #f3f4f6; text-align: center;">Tiêu đề 2 (Gộp ô)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Nội dung 1</td>
          <td style="background-color: #fee2e2;">Cảnh báo (Đỏ)</td>
          <td>Nội dung 3</td>
        </tr>
      </tbody>
    </table>
    ```
*   **Khả năng tương thích:** Chuẩn Markdown gốc của CommonMark/GFM cho phép render trực tiếp mã HTML `<table>` lồng nhau. Việc lưu dưới dạng HTML giúp sơ đồ bảng vẫn hiển thị hoàn hảo trên GitHub, VS Code, Obsidian hoặc bất kỳ trình đọc Markdown chuẩn nào khác.
*   **Hỗ trợ Tính năng Bảng Nâng cao:**
    *   **Gộp ô (Merge Cells):** Sử dụng các thuộc tính `colspan` và `rowspan` chuẩn HTML.
    *   **Tô màu nền (Background Highlight):** Người dùng chọn từ một bộ bảng màu cố định được chuẩn hóa (ví dụ: Đỏ/Cảnh báo, Xanh/Thành công, Vàng/Lưu ý, Xám/Nhạt). Mã màu Hex tương ứng của bộ màu này là cố định và được ghi trực tiếp nội dòng `style="background-color: #HEX_CODE;"` để đảm bảo tính thẩm mỹ đồng nhất.
    *   **Căn chỉnh (Alignment):** Sử dụng thuộc tính `text-align` hoặc inline style để định cấu hình.

### C. Nâng cấp Parser Markdown ↔ HTML/JSON
*   **Bảo toàn Frontmatter:** Trích xuất phần cấu hình YAML (`--- ... ---`) ở đầu file trước khi đưa vào TipTap, và ghép lại nguyên vẹn khi lưu.
*   **Không chạm vào thẻ HTML Bảng:** Cải tiến parser markdown-it (hoặc bộ chuyển đổi đầu vào của TipTap) để phát hiện khối `<table>` và nạp nguyên vẹn cấu trúc DOM của nó vào TipTap Table Extension, tránh chuyển đổi ngược về dạng ống (`|`).

---

## 3. Danh sách Công việc (Checklist Triển khai)

- [ ] **Tái cấu trúc UI Editor (Loại bỏ Side-by-Side):**
  - Xóa bỏ logic phân chia màn hình (Split Panels) trong `src/features/SidebySide/` hoặc `EditorWorkspace.tsx`.
  - Thiết kế nút chuyển đổi View Mode đơn giản trên thanh tiêu đề: `[ Viết tài liệu (WYSIWYG) | Xem Code (Monaco) ]`.
- [ ] **Nâng cấp Table Serializer:**
  - Cấu hình TipTap Table Extension để khi lưu file (gọi hàm xuất Markdown) sẽ giữ nguyên thẻ HTML `<table>` thay vì convert sang cú pháp ống (`|`).
  - Viết bộ lọc parser đảm bảo việc đọc ngược lại file `.md` chứa thẻ `<table>` HTML được render đúng cấu trúc ô gộp và màu sắc trong TipTap.
- [ ] **Kiểm thử hồi quy:**
  - Thử nghiệm các thao tác gộp ô dọc (rowspan), gộp ô ngang (colspan), và tô màu ô nền đỏ/xanh, lưu lại file, mở lại để xác nhận định dạng được bảo toàn 100%.
