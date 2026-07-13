# Báo cáo Đánh giá Sản phẩm (Feature Roast): depdok
**Vai trò:** Giám đốc Marketing DevTools (10+ năm kinh nghiệm trong mảng B2B SaaS & Developer Tools)  
**Ngôn ngữ:** Tiếng Việt  
**Tài liệu liên quan:** [Đề xuất Cải tiến & GTM](file:///Users/hudy/ws/depdok/docs/marketing/product_improvements.md)

---

## 1. Định vị Sản phẩm Hiện tại: "Lửng lơ con cá vàng"
Định vị hiện tại của `depdok` là *"editor dành cho lập trình viên viết technical docs — chứ không viết code"*. Nghe thì có vẻ tập trung, nhưng dưới góc nhìn marketing, đây là một điểm yếu chí mạng:
*   **Dev không muốn mở thêm app:** Lập trình viên vốn cực kỳ lười cài thêm công cụ mới nếu nó không giải quyết được một vấn đề cực kỳ lớn. Nếu chỉ để gõ Markdown thông thường, họ sẽ mở ngay một tab mới trong VS Code/Cursor vốn đang chạy 24/7 trên máy của họ.
*   **Wiki team đã có Notion/Confluence:** Nếu là tài liệu dùng chung cho cả dự án, họ bắt buộc phải viết trên các nền tảng đám mây của công ty để đồng nghiệp cùng đọc và bình luận. Việc viết cục bộ (local) rồi đẩy lên Git bằng Markdown chỉ phù hợp với một số nhóm nhỏ hoặc dự án mã nguồn mở.

---

## 2. Phân tích Đối thủ Cạnh tranh (Competitive Landscape)

| Đối thủ | Ưu điểm | Nhược điểm lớn nhất | `depdok` đối đầu thế nào? |
| :--- | :--- | :--- | :--- |
| **Obsidian** | Hệ sinh thái plugin khổng lồ, cộng đồng mạnh, quản lý liên kết và Graph View xuất sắc. | Setup rất phức tạp, không tối ưu sâu cho sơ đồ (Mermaid) và quy trình Git. | `depdok` thắng ở khả năng tương tác trực tiếp với sơ đồ (click nhảy tới dòng code) và tích hợp Git/RAG sẵn có. |
| **VS Code / Cursor** | Dev mở sẵn cả ngày. Đầy đủ extension cho Markdown, Mermaid Preview. | Giao diện rối mắt cho việc viết lách. Thiếu chế độ WYSIWYG mượt mà để focus viết tài liệu. | `depdok` mang lại không gian viết tập trung, tách biệt việc code và viết tài liệu thiết kế. |
| **Eraser.io / IcePanel** | Vẽ sơ đồ bằng AI/kéo thả cực đẹp, cộng tác thời gian thực xuất sắc. | Cloud-first (rò rỉ IP của công ty), giá đắt đỏ, không chạy offline hoàn toàn. | `depdok` là giải pháp thay thế hoàn hảo cho môi trường bảo mật cao nhờ Local-first và RAG offline. |
| **Typora** | Trải nghiệm viết Markdown WYSIWYG (Hybrid) tốt nhất thị trường, xuất PDF/HTML đẹp. | Không có AI trợ lý, không quản lý thư mục/Git sâu, không tương tác được với sơ đồ. | `depdok` vượt trội về AI RAG, MCP Server và tính tương tác với sơ đồ kỹ thuật. |

---

## 3. Roast Chi tiết từng Tính năng Hiện tại (Deep Dive Roast)

### A. Markdown (TipTap & Monaco Dual Mode)
*   **Giao diện Split-pane lỗi thời:** Việc bắt người dùng chuyển đổi qua lại hoặc chia đôi màn hình giữa Monaco (chế độ Code) và TipTap (chế độ Preview) gây mất tập trung. Hầu hết các editor hiện đại (Typora, Obsidian Live Preview, Notion) đều dùng cơ chế WYSIWYG Hybrid (gõ đến đâu render trực tiếp đến đó trên cùng một dòng).
*   **Lệch scroll & giật lag:** Việc đồng bộ cuộn (scroll-sync) giữa hai editor khác nhau về bản chất hiển thị luôn xảy ra hiện tượng giật lag hoặc lệch dòng ở những file tài liệu dài, gây khó chịu cho người viết.
*   **Formatting Loss (Mất định dạng):** Khi chuyển đổi qua lại giữa TipTap (ProseMirror HTML/JSON) và Monaco (Raw Markdown), parser rất dễ làm mất hoặc thay đổi cấu trúc của Frontmatter metadata ở đầu file, các tag HTML tự nhúng, hoặc comment ẩn.

### B. PlantUML (Offline Engine)
*   **Điểm cộng kỹ thuật:** Sử dụng thư viện `beautiful-plantuml` để render hoàn toàn ở phía client (webview) không phụ thuộc JRE hay Graphviz là một bước đi xuất sắc để bảo vệ quyền riêng tư dữ liệu.
*   **Hỗ trợ sơ đồ quá nghèo nàn:** PlantUML cực mạnh ở các sơ đồ Class, Component, Use Case. Tuy nhiên, engine offline hiện tại **hầu như chỉ hỗ trợ Sequence Diagram** (`<SequenceDiagram />`). Nếu dev viết các sơ đồ khác, parser sẽ báo lỗi hoặc không hiển thị được.
*   **Mã nguồn vẫn tồn tại fallback online:** Trong `PreviewPlantUML/index.tsx`, hệ thống vẫn tự động fallback gửi mã sơ đồ đến `https://img.plantuml.biz/plantuml/...` nếu render offline lỗi. Điều này phá vỡ cam kết "100% bảo mật dữ liệu offline" mà không hề cảnh báo cho người dùng.

### C. Mermaid
*   **Tính năng tương tác nửa vời:** Khả năng click phần tử sơ đồ để nhảy tới dòng code tương ứng chỉ hoạt động trên `sequenceDiagram`. Các sơ đồ thông dụng khác (như `flowchart`, `classDiagram`) hoàn toàn là sơ đồ tĩnh.
*   **Treo UI khi sơ đồ quá lớn:** Mermaid render SVG thông qua JavaScript. Mỗi lần người dùng gõ phím, hệ thống lại render lại sơ đồ trong thời gian thực, dẫn đến giao diện soạn thảo bị đơ (UI freeze) khi làm việc với sơ đồ kiến trúc lớn.

### D. Logger / LoggerEditor
*   **Tính năng thừa thãi trên giao diện chính:** Sự xuất hiện của LoggerEditor trên thanh sidebar/tabs soạn thảo tài liệu làm rối loạn luồng trải nghiệm người dùng (UX). Lập trình viên khi viết tài liệu thiết kế hệ thống không cần và không muốn nhìn thấy log hoạt động nội bộ của app liên tục.

### E. Excalidraw
*   **Thảm họa Git Diff:** Excalidraw lưu trữ dữ liệu bản vẽ dưới dạng các file JSON cực kỳ lớn chứa tọa độ chi tiết. Khi đẩy lên Git, mỗi thay đổi nhỏ (như kéo lệch một mũi tên) sẽ tạo ra hàng ngàn dòng diff JSON không thể đọc được, làm "rác" Git history và gây ức chế cho người review Pull Request.
*   **Liên kết Markdown rời rạc:** Việc nhúng hình Excalidraw vào tài liệu vẫn yêu cầu người dùng tự xuất ra file ảnh rồi tham chiếu thủ công. Khi sửa bản vẽ, quy trình này phải lặp lại từ đầu.

---

*Để xem các giải pháp cải tiến chi tiết và kế hoạch Go-To-Market cho những điểm yếu trên, hãy đọc tiếp tại: [Tài liệu Đề xuất Cải tiến & GTM](file:///Users/hudy/ws/depdok/docs/marketing/product_improvements.md)*
