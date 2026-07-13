# Kế hoạch Nâng cấp 5: Cộng tác Offline-First & Quy trình Git
**Mã tài liệu:** `docs/plan/5-offline-collaboration.md`  
**Mục tiêu:** Tối ưu hóa việc làm việc nhóm dựa trên nền tảng offline và quy trình Git, loại bỏ các trở ngại khi giải quyết xung đột tài liệu và chia sẻ kết quả thiết kế.  
**Tài liệu tham chiếu:** [Đề xuất Cải tiến & GTM](file:///Users/hudy/ws/depdok/docs/marketing/product_improvements.md)

---

## 1. Vấn đề Hiện tại
*   Việc làm việc nhóm trên file Markdown thông qua Git thường dẫn đến xung đột (merge conflicts). Khi có conflict, các ký tự Git Marker (`<<<<<<< HEAD`, `=======`) xuất hiện sẽ làm hỏng parser hiển thị của trình soạn thảo trực quan (TipTap), buộc người dùng phải nhảy sang chế độ Monaco Code View để tự sửa bằng tay rất phiền phức.
*   Lịch sử Git (Git Diff) của các sơ đồ Mermaid/PlantUML rất khó theo dõi vì nó chỉ hiển thị các dòng text thô thay đổi, lập trình viên không thể hình dung nhanh sơ đồ thực tế đã được thay đổi như thế nào nếu không tự render cả hai phiên bản.
*   Những người không cài đặt ứng dụng `depdok` (ví dụ: Product Manager, Khách hàng) không thể xem và tương tác trực tiếp với các sơ đồ thiết kế.

---

## 2. Giải pháp Kỹ thuật & UI/UX

### A. Công cụ Giải quyết Xung đột Trực quan (Visual Conflict Resolution for Markdown)
*   **Phát hiện Conflict:** Khi phát hiện file Markdown có chứa các ký tự Git Conflict Markers (`<<<<<<< HEAD`), trình soạn thảo WYSIWYG sẽ bọc khu vực xung đột đó lại bằng một Custom Node đặc biệt có viền màu đỏ nổi bật.
*   **Giao diện Chọn lựa (Visual Chooser UI):** 
    *   Hiển thị rõ ràng hai khối nội dung song song hoặc xếp chồng: **[Phiên bản của bạn (Local)]** và **[Phiên bản từ xa (Remote)]**.
    *   Bên trên mỗi khối sẽ có nút bấm hành động nhanh: `[Chấp nhận phiên bản này]` hoặc `[Giữ cả hai]`. Click chọn sẽ tự động dọn dẹp các ký tự Marker của Git và cập nhật file ngay lập tức mà không cần gõ phím.

### B. Visual Git Diff dành riêng cho Sơ đồ (Diagram)
*   **Side-by-Side Diagram Diff View:** Trong giao diện quản lý lịch sử Git của app, khi click vào một file chứa sơ đồ Mermaid/PlantUML đã thay đổi, app sẽ render hai bản vẽ sơ đồ:
    *   Bên trái: Sơ đồ trước khi thay đổi (Old Version - Màu đỏ mờ).
    *   Bên phải: Sơ đồ sau khi thay đổi (New Version - Màu xanh lá mờ).
*   **Highlight phần thay đổi:** Sử dụng CSS để làm nổi bật (màu sắc/viền) các đối tượng (actor, box) được thêm mới hoặc bị xoá bỏ trong sơ đồ mới.

### C. One-Click Static Site Exporter
*   **Lệnh build trang tĩnh:** Viết thêm module trong CLI (`depdok build`) hoặc nút bấm xuất bản trên thanh công cụ.
*   **VitePress/Hugo Layout Export:** Xuất toàn bộ thư mục tài liệu Markdown hiện tại thành một trang tĩnh HTML/CSS chạy client-side mượt mà, bao gồm cả các file JS nhúng để render sơ đồ động.
*   **Không cần cài app vẫn tương tác được:** Người khác chỉ cần mở file `index.html` xuất ra trên trình duyệt là có thể đọc tài liệu và click tương tác với các sơ đồ Mermaid/PlantUML bình thường.

---

## 3. Danh sách Công việc (Checklist Triển khai)

- [ ] **Phát triển Visual Conflict Node:**
  - Viết bộ lọc parser phát hiện conflict markers trong Markdown trước khi nạp vào TipTap.
  - Tạo `ConflictResolutionBlock` trong frontend React cho phép người dùng so sánh và click lựa chọn trực quan.
- [ ] **Triển khai Visual Diagram Diff:**
  - Viết cơ chế lấy nội dung cũ của file sơ đồ từ Git history (`git show HEAD:<path>`).
  - Xây dựng layout hiển thị so sánh hai sơ đồ song song trong giao diện Branch/Commit view.
- [ ] **Xây dựng Static Site Exporter:**
  - Phát triển template HTML/CSS tối giản tích hợp sẵn thư viện Mermaid/PlantUML client-side.
  - Tạo lệnh `depdok build` trong Rust để thực hiện sao chép tài nguyên và xuất trang tĩnh tự động.
