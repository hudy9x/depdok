# Kế hoạch Nâng cấp 3: Lưu File Excalidraw dưới Định dạng SVG
**Mã tài liệu:** `docs/plan/3-offline-collaboration.md`  
**Mục tiêu:** Chuyển đổi định dạng lưu file `.excalidraw` từ JSON thuần sang SVG có nhúng dữ liệu JSON, giúp file có thể xem trực tiếp trên trình duyệt/GitHub mà không cần ứng dụng.  
**Tài liệu tham chiếu:** [Đề xuất Cải tiến & GTM](file:///Users/hudy/ws/depdok/docs/marketing/3-product_improvements.md)

---

## 1. Vấn đề Hiện tại

*   File `.excalidraw` hiện được lưu dưới dạng JSON thuần — định dạng nội bộ của Excalidraw (`serializeAsJSON`). File này không thể xem trực tiếp trên GitHub, trình duyệt, hay bất kỳ công cụ nào bên ngoài ứng dụng.
*   Khi chia sẻ file thiết kế qua Git, người nhận phải cài ứng dụng `depdok` để xem nội dung — tạo rào cản lớn với PM, khách hàng, hoặc cộng tác viên không cài app.
*   Git diff của file JSON Excalidraw rất khó theo dõi — không có cách nào nhìn thấy sơ đồ thực tế đã thay đổi như thế nào.

---

## 2. Giải pháp Kỹ thuật & UI/UX

### A. Định dạng Lưu Mới: SVG có Nhúng JSON

*   **Khi lưu:** Thay vì gọi `serializeAsJSON`, gọi `exportToSvg` (API công khai của `@excalidraw/excalidraw`) để xuất ra `SVGSVGElement`, sau đó nhúng JSON scene vào attribute `data-excalidraw-json` trên thẻ `<svg>` root trước khi serialize thành string.
*   **Kết quả:** File `.excalidraw` là một file SVG hợp lệ — có thể mở trực tiếp trên trình duyệt và GitHub, đồng thời chứa đầy đủ dữ liệu để app load lại mà không mất thông tin.
*   **Tương thích ngược:** Hàm `parseScene` được cập nhật để nhận diện cả hai định dạng — file SVG mới (nhận biết qua `<svg`) và file JSON cũ (nhận biết qua `{`), đảm bảo các file `.excalidraw` cũ không bị hỏng.

### B. Cập nhật `parseScene` để đọc SVG

*   Kiểm tra nếu nội dung bắt đầu bằng `<` → parse XML, lấy attribute `data-excalidraw-json` từ thẻ `<svg>`, JSON-parse để lấy scene.
*   Nếu không phải SVG, thử JSON-parse như cũ (backward compat).

### C. Cập nhật seed file rỗng

*   Khi tạo file `.excalidraw` mới qua dialog, seed nội dung ban đầu vẫn có thể là JSON (vì `parseScene` hiểu được). File sẽ tự động chuyển sang định dạng SVG ngay khi lần đầu có chỉnh sửa và lưu.

---

## 3. Danh sách Công việc (Checklist Triển khai)

- [ ] **Cập nhật `ExcalidrawPreview.tsx`:**
  - Thêm `exportToSvg` vào interface `ExcalidrawModule`.
  - Trong `handleChange`: thay `serializeAsJSON` bằng `exportToSvg`, nhúng JSON vào `data-excalidraw-json` attribute, serialize SVG thành string.
  - Cập nhật `parseScene` để xử lý cả SVG (đọc attribute) và JSON (backward compat).
- [ ] **Kiểm tra tương thích ngược:**
  - Mở file `.excalidraw` cũ định dạng JSON → xác nhận load không lỗi.
  - Mở file `.excalidraw` mới định dạng SVG → xác nhận round-trip đầy đủ.
- [ ] **Kiểm tra xem SVG trực tiếp:**
  - Lưu một file sau khi vẽ, mở file bằng trình duyệt → xác nhận SVG hiển thị đúng hình vẽ.
