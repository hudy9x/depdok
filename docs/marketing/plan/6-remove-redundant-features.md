# Kế hoạch Nâng cấp 6: Xóa các Tính năng Dư thừa (Format & Logger)
**Mã tài liệu:** `docs/marketing/plan/6-remove-redundant-features.md`  
**Mục tiêu:** Thực hiện loại bỏ hoàn toàn hai tính năng dư thừa là **Webhook Logger** (`.logger`) và **Flowchart Format Pad** (`.format`) khỏi codebase của dự án. Điều này giúp giảm thiểu đáng kể kích thước gói bundle, loại bỏ sự phức tạp không cần thiết trong UX soạn thảo tài liệu kỹ thuật, và thu gọn luồng xử lý file/cài đặt.  
**Tài liệu tham chiếu:** [Báo cáo Đánh giá Sản phẩm (Feature Roast)](file:///Users/hudy/ws/depdok/docs/marketing/2-feature_roast.md), [Đề xuất Cải tiến & GTM](file:///Users/hudy/ws/depdok/docs/marketing/3-product_improvements.md)

---

## 1. Lý do Loại bỏ

*   **Tính năng Webhook Logger (`.logger`):** Được thiết kế như một webhook receiver cục bộ phục vụ việc stream log từ bên ngoài. Tuy nhiên, tính năng này làm rối loạn luồng UX chính vì người dùng soạn thảo tài liệu không cần xem log hệ thống. Việc xử lý file cấu hình `.logger` gây thêm nhiều code thừa trong luồng lưu file và quản lý tab.
*   **Tính năng Flowchart Format Pad (`.format`):** Đây là một công cụ so sánh và hiển thị cây dữ liệu dạng flow vẽ bằng React Flow. Tính năng này quá xa rời mục tiêu của Depdok là viết tài liệu kỹ thuật (Markdown, Mermaid, PlantUML), đồng thời thư viện `@xyflow/react` kéo theo nhiều phụ thuộc nặng nề không cần thiết trong gói bundle frontend.

---

## 2. Danh sách các File cần xóa hoàn toàn

### A. Thư mục và File Frontend
*   `src/features/LoggerEditor/` (Toàn bộ thư mục bao gồm giao diện xem log, header và các dòng log)
*   `src/features/PreviewFormat/` (Toàn bộ thư mục chứa React Flow preview, DiffViewer, FormatBlock, v.v.)
*   `src/lib/format-parser/` (Bộ phân giải cú pháp file `.format` dạng YAML/JSON)
*   `src/lib/monaco-theme/format/` (Cấu hình màu sắc token cho định dạng `.format` trong Monaco)
*   `src/lib/monaco-actions/register-format-block-action.ts` (Action đăng ký phím tắt định dạng khối cho file format)
*   `src/lib/monaco-actions/register-format-line-popover.ts` (Lớp phủ popover dòng cho file format)
*   `src/lib/monaco-actions/format-formatter.ts` (Logic format mã nguồn JSON/XML/YAML)
*   `src/api-client/logger.ts` (API client gọi tauri commands cho logger server)

### B. File Backend Rust
*   `src-tauri/src/commands/logger.rs` (Tauri commands và server Axum nhận log qua HTTP port 8080)

---

## 3. Chi tiết các File cần chỉnh sửa & Dọn dẹp

### A. Dọn dẹp Backend Rust (`src-tauri`)

#### 1. [MODIFY] [mod.rs](file:///Users/hudy/ws/depdok/src-tauri/src/commands/mod.rs)
*   Xóa dòng khai báo module logger: `pub mod logger;`

#### 2. [MODIFY] [lib.rs](file:///Users/hudy/ws/depdok/src-tauri/src/lib.rs)
*   Xóa khởi tạo trạng thái logger server trong setup:
    ```rust
    // Xóa dòng này
    app.manage(commands::logger::LoggerServerState::new());
    ```
*   Xóa đăng ký hai commands trong list `invoke_handler`:
    ```rust
    // Xóa các dòng này
    commands::logger::start_logger_server,
    commands::logger::register_logger_channel,
    ```

---

### B. Dọn dẹp Frontend (`src`)

#### 1. [MODIFY] [fileSupport.ts](file:///Users/hudy/ws/depdok/src/lib/fileSupport.ts)
*   Xóa `'logger'` và `'format'` khỏi mảng `CUSTOM_PREVIEW_EXTENSIONS`.

#### 2. [MODIFY] [FileIcon.tsx](file:///Users/hudy/ws/depdok/src/components/FileIcon.tsx)
*   Xóa kiểm tra icon `.logger` và `.format` và các import Lucide icons tương ứng (`Radio`, `Braces`).

#### 3. [MODIFY] [PreviewPanel.tsx](file:///Users/hudy/ws/depdok/src/features/Preview/PreviewPanel.tsx)
*   Xóa các import `LoggerEditor` và `FormatPreview`.
*   Xóa các block `if (fileExtension === "format")` và `if (fileExtension === "logger")`.

#### 4. [MODIFY] [Home.tsx](file:///Users/hudy/ws/depdok/src/pages/Home.tsx)
*   Xóa `"format"` và `"logger"` khỏi danh sách `supportedFileTypes`.

#### 5. [MODIFY] [AppMenuListener.tsx](file:///Users/hudy/ws/depdok/src/components/AppMenuListener.tsx)
*   Xóa `"format"` và `"logger"` khỏi danh sách `supportedFileTypes`.

#### 6. [MODIFY] [CreateTabButton.tsx](file:///Users/hudy/ws/depdok/src/features/EditorTabs/CreateTabButton.tsx)
*   Xóa hai loại file `{ extension: 'format', label: 'Format' }` và `{ extension: 'logger', label: 'Logger' }` khỏi mảng `fileTypes`.
*   Xóa `"format"` và `"logger"` khỏi mảng extensions trong dialog mở file.

#### 7. [MODIFY] [EditorSaveHandler.tsx](file:///Users/hudy/ws/depdok/src/features/Editor/EditorSaveHandler.tsx)
*   Xóa `"format"` và `"logger"` khỏi `supportedFileTypes`.
*   Xóa các nhánh xử lý lưu file kết thúc bằng `.logger` (`else if (currentPath.endsWith(".logger"))` và `else if (editorState.filePath.endsWith(".logger"))`).

#### 8. [MODIFY] [index.tsx](file:///Users/hudy/ws/depdok/src/features/EditorViewMode/index.tsx)
*   Xóa dòng cấu hình chế độ xem của logger trong `EXTENSION_SUPPORTED_MODES`:
    ```typescript
    // Xóa dòng này
    logger: ["side-by-side", "preview-only"],
    ```

#### 9. [MODIFY] [MonacoEditor.tsx](file:///Users/hudy/ws/depdok/src/features/Editor/MonacoEditor.tsx)
*   Xóa import `registerFormatBlockAction` và `registerFormatLinePopover`.
*   Xóa import `setupFormatTheme`.
*   Xóa lệnh gọi `setupFormatTheme(monaco)`.
*   Xóa lệnh gọi `registerFormatBlockAction` và `registerFormatLinePopover`.

#### 10. [MODIFY] [index.ts](file:///Users/hudy/ws/depdok/src/lib/monaco-actions/index.ts)
*   Xóa export của `registerFormatBlockAction`.

#### 11. [MODIFY] [index.ts](file:///Users/hudy/ws/depdok/src/lib/monaco-theme/index.ts)
*   Xóa import và export của `registerFormatLanguage`, `applyFormatTokenColors`, `setupFormatTheme`.

#### 12. [MODIFY] [getMonacoLanguage.ts](file:///Users/hudy/ws/depdok/src/lib/utils/getMonacoLanguage.ts)
*   Xóa điều kiện check định dạng `.format` trong mapper ngôn ngữ Monaco.

---

## 4. Kế hoạch Kiểm thử & Xác minh

### Kiểm thử biên dịch & chạy thử
1.  Chạy lệnh cài đặt lại dependency (nếu có thay đổi) và build thử frontend để đảm bảo không lỗi import:
    *   `pnpm build`
2.  Chạy thử ứng dụng Tauri:
    *   `pnpm app-dev`
3.  Xác nhận ứng dụng tải bình thường không lỗi màn hình trắng.

### Xác minh thủ công
1.  **Giao diện Trang chủ:**
    *   Mở menu "Create new file" (+) → Xác nhận danh sách chỉ còn các loại file hợp lệ, không có "Format" và "Logger".
    *   Bấm "Open File..." → Không chọn được và bộ lọc không hỗ trợ file `.format` / `.logger`.
2.  **Khả năng hoạt động ổn định:**
    *   Mở các định dạng file còn lại (Markdown, Mermaid, Todo, Excalidraw, PlantUML) và kiểm tra soạn thảo/lưu bình thường.
