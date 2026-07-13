# Đề xuất Cải tiến & Chiến lược GTM: depdok
**Vai trò:** Giám đốc Marketing DevTools (10+ năm kinh nghiệm trong mảng B2B SaaS & Developer Tools)  
**Ngôn ngữ:** Tiếng Việt  
**Tài liệu liên quan:** [Báo cáo Đánh giá Sản phẩm (Feature Roast)](file:///Users/hudy/ws/depdok/docs/marketing/feature_roast.md)

---

## 1. Khái niệm "Collaboration" trong thế giới Offline-First

Khi xây dựng ứng dụng cục bộ (local-first) và bảo mật tuyệt đối, chúng ta không hướng tới việc cộng tác thời gian thực qua đám mây như Google Docs. Thay vào đó, sự cộng tác của các lập trình viên sẽ xoay quanh quy trình **Git & Pull Request**.

Để giải quyết các rào cản cộng tác này, `depdok` cần bổ sung các tính năng:
*   **Visual Markdown Conflict Tool:** Khi Git xảy ra conflict, thay vì hiển thị các ký tự code lỗi `<<<<<<< HEAD`, hãy hiển thị một giao diện so sánh trực quan hai phiên bản Markdown ngay trên TipTap để người dùng chọn giữ phiên bản nào chỉ bằng một cú click chuột.
*   **Visual Git Diff cho Sơ đồ (Diagram):** Khi xem lịch sử thay đổi, thay vì hiển thị diff dạng text thô, hãy render hình ảnh sơ đồ cũ bên cạnh sơ đồ mới và highlight các khu vực được chỉnh sửa.
*   **One-Click Static Site Exporter:** Lập lệnh `depdok build` cho phép xuất toàn bộ thư mục tài liệu thành một trang web tĩnh (như cấu trúc VitePress/Hugo) có đầy đủ sơ đồ tương tác. Dev có thể đẩy trang web này lên GitHub Pages hoặc host cục bộ để cả team cùng đọc qua trình duyệt mà không cần cài đặt ứng dụng.

---

## 2. Giải pháp Cải tiến Tính năng Cốt lõi (Product Solutions)

### A. Markdown: Chuyển dịch sang WYSIWYG Hybrid
*   **Đồng nhất Editor:** Hướng tới giao diện chỉnh sửa tích hợp (như Typora). Mặc định hiển thị định dạng WYSIWYG đẹp đẽ, nhưng khi rê chuột hoặc click vào dòng tiêu đề/in đậm, nó sẽ hiển thị cú pháp Markdown thô (`#`, `**`) để chỉnh sửa nhanh.
*   **Bảo toàn định dạng tuyệt đối:** Cải tiến bộ chuyển đổi Markdown ↔ HTML để nó cô lập hoàn toàn Frontmatter metadata, các thẻ comment ẩn `<!-- comment -->` và lưu trữ nguyên vẹn cấu trúc thô của chúng khi lưu file.

### B. PlantUML & Mermaid: Nâng cấp Sơ đồ Độc quyền
*   **Mở rộng bộ parser offline:** Đầu tư mở rộng thư viện `beautiful-plantuml` để hỗ trợ thêm **Class Diagram** và **Component Diagram** (hai loại sơ đồ phổ biến thứ hai và thứ ba sau Sequence).
*   **Cảnh báo Fallback Online:** Nếu buộc phải gửi sơ đồ lên online server khi offline engine không dịch được, app bắt buộc phải hiển thị một popup cảnh báo bảo mật: *"Sơ đồ này quá phức tạp và cần render online qua server của bên thứ ba. Bạn có đồng ý gửi dữ liệu này đi không?"*.
*   **Debounced & Asynchronous Rendering:** Trì hoãn việc render sơ đồ SVG khoảng 300-500ms sau khi người dùng ngừng gõ phím. Đồng thời đưa tác vụ render sơ đồ vào Web Worker chạy nền để không làm nghẽn UI thread của editor.

### C. LoggerEditor: Tinh giản Không gian làm việc
*   Đưa `LoggerEditor` ra khỏi thanh sidebar chính. Biến nó thành một tuỳ chọn ẩn trong menu Settings (ví dụ: "View System Logs" phục vụ mục đích debug khi app gặp lỗi) để trả lại không gian tối giản cho nhà soạn thảo.

### D. Excalidraw: Tối ưu hoá cho Git và Markdown
*   **Lưu trữ dạng SVG có nhúng Metadata:** Thay vì lưu file vẽ bằng JSON thô gây thảm họa Git diff, hãy xuất mặc định ra file ảnh `.svg`. Phía bên trong file SVG sẽ nhúng chìm đoạn code JSON cấu trúc của Excalidraw. Khi vẽ, Git diff sẽ chỉ hiển thị sự thay đổi của ảnh SVG nhỏ gọn, nhưng khi mở bằng `depdok`, app vẫn đọc được metadata JSON ẩn để cho phép chỉnh sửa tiếp tục.
*   **TipTap Block Integration:** Cho phép nhúng Excalidraw trực tiếp như một block đặc biệt trong Markdown. Click đúp vào hình vẽ sẽ mở ngay canvas chỉnh sửa tại chỗ, tự động lưu và cập nhật ảnh nhúng.

---

## 3. Phân khúc Khách hàng & Kế hoạch Go-To-Market (GTM)

### Phân khúc Lead Users hàng đầu:
1.  **Software Architects & Tech Leads:** Những người thiết kế hệ thống lớn, cần lưu trữ tài liệu kiến trúc (ADR, RFC, Mermaid) trực tiếp trong kho mã nguồn Git của dự án.
2.  **Đội ngũ Bảo mật / Doanh nghiệp có tiêu chuẩn cao (Tài chính, Y tế, Chính phủ):** Những nơi cấm tuyệt đối nhân viên gửi mã nguồn hay sơ đồ hệ thống lên các nền tảng AI Cloud như ChatGPT/Notion. Họ cần một giải pháp viết tài liệu thông minh chạy 100% offline.

### Kế hoạch Monetization (Định giá):
*   **Free Tier (Core Editor):** Soạn thảo Markdown mượt mà, render sơ đồ offline cơ bản, quản lý Git branch.
*   **Pro Tier ($8 - $12/tháng):** Kích hoạt lại `LicenseGuard` để khoá các tính năng đem lại giá trị thương mại lớn như:
    *   *AI Assistant trợ lý thiết kế (Local RAG chạy offline).*
    *   *MCP Server kết nối tài liệu với VS Code / Cursor.*
    *   *Xuất PDF/HTML theo mẫu thiết kế chuyên nghiệp (Custom CSS).*
    *   *Tương tác sơ đồ nâng cao (Click-to-jump cho Flowchart).*

---

*Để đối chiếu lại các điểm yếu của hệ thống hiện tại, hãy xem: [Báo cáo Đánh giá Sản phẩm (Feature Roast)](file:///Users/hudy/ws/depdok/docs/marketing/feature_roast.md)*
