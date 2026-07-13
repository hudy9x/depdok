# Kế hoạch Nâng cấp 4: Tối ưu hóa Excalidraw & Git History
**Mã tài liệu:** `docs/plan/4-excalidraw-git-integration.md`  
**Mục tiêu:** Giải quyết thảm họa Git Diff do file JSON Excalidraw cồng kềnh gây ra và đơn giản hóa quy trình nhúng bản vẽ tự do vào tài liệu Markdown.  
**Tài liệu tham chiếu:** [Báo cáo Đánh giá Sản phẩm (Feature Roast)](file:///Users/hudy/ws/depdok/docs/marketing/feature_roast.md)

---

## 1. Vấn đề Hiện tại
*   Excalidraw lưu trữ dữ liệu vẽ dưới dạng một mảng JSON khổng lồ ghi lại tọa độ hình học chi tiết của từng nét vẽ. Khi đẩy lên Git, mỗi chỉnh sửa nhỏ sẽ sinh ra hàng ngàn dòng diff JSON không thể đọc được, làm ô nhiễm Git history và cản trở việc review code/docs.
*   Việc nhúng bản vẽ Excalidraw vào Markdown hiện tại rất rời rạc: người dùng phải vẽ, tự xuất ra file PNG/SVG, rồi gõ cú pháp nhúng thủ công. Khi cần sửa, quy trình này phải lặp lại từ đầu.

---

## 2. Giải pháp Kỹ thuật & UI/UX

### A. Định dạng Lưu trữ SVG nhúng Metadata (SVG-with-Metadata)
*   **Không lưu trực tiếp JSON thô:** Thay vì ghi file `.excalidraw` dạng JSON thuần ra đĩa, `depdok` sẽ xuất bản vẽ ra định dạng `.svg` tiêu chuẩn để hiển thị trực quan.
*   **Nhúng JSON vào SVG:** Excalidraw cung cấp API cho phép nhúng chuỗi JSON mô tả bản vẽ vào bên trong các thẻ metadata ẩn của file SVG (ví dụ nhúng vào thẻ `<metadata>` hoặc thuộc tính tùy biến).
*   **Hiệu quả Git:** 
    *   Khi đẩy lên Git, file SVG thay đổi sẽ tạo ra các dòng diff XML nhỏ gọn và dễ quản lý hơn nhiều so với JSON thô của toạ độ hình vẽ.
    *   Khi người dùng mở dự án trong `depdok`, ứng dụng sẽ tự động trích xuất chuỗi JSON ẩn trong SVG để khôi phục lại trạng thái canvas chỉnh sửa đầy đủ cho người dùng.

### B. Tích hợp Block Vẽ Trực tiếp trong Markdown (Inline Drawing Node)
*   **TipTap Custom Node:** Xây dựng một node tùy biến trong TipTap cho Excalidraw.
*   **Click-to-Edit tại chỗ:** Người dùng chỉ cần gõ `/draw` hoặc bấm nút trên toolbar, một khung vẽ trống sẽ hiện ra ngay trong dòng tài liệu.
*   **Tự động cập nhật:** Khi người dùng vẽ xong và thoát khỏi canvas, hệ thống tự động lưu file ảnh SVG ẩn vào thư mục tài sản cục bộ của dự án (ví dụ `.depdok/assets/`) và chèn đường dẫn ảnh tương ứng vào Markdown. Click đúp vào ảnh sẽ mở lại trình chỉnh sửa vẽ tức thì.

---

## 3. Danh sách Công việc (Checklist Triển khai)

- [ ] **Phát triển Module SVG-with-Metadata:**
  - Viết helper function `exportToSvgWithMetadata(elements, appState)` sử dụng API của Excalidraw.
  - Viết helper function `importFromJsonFromSvg(svgString)` để trích xuất ngược lại JSON cấu trúc từ file SVG.
- [ ] **Xây dựng TipTap Excalidraw Extension:**
  - Tạo `ExcalidrawNode` quản lý việc hiển thị canvas vẽ thu nhỏ (preview) trực tiếp trong luồng tài liệu.
  - Cấu hình việc lưu trữ tự động các file ảnh SVG xuất ra vào thư mục `.depdok/assets/`.
- [ ] **Kiểm thử Git Diff:**
  - Thực hiện vẽ, chỉnh sửa thử nghiệm một sơ đồ Excalidraw và so sánh sự khác biệt của Git Diff giữa định dạng cũ (JSON) và định dạng mới (SVG-with-Metadata).
