# Kế hoạch Nâng cấp 2: Unified Hybrid WYSIWYG Editor & HTML Table Integration
**Mã tài liệu:** `docs/plan/2-markdown-editor-hybrid.md`  
**Mục tiêu:** Vô hiệu hóa chế độ `side-by-side` đối với tài liệu Markdown (nhưng vẫn giữ lại codebase `SideBySide` để tái sử dụng cho các định dạng file khác như `.npuml`/`.nplantuml`), giữ lại hai chế độ `editor-only` (Monaco) và `preview-only` (TipTap/Preview) cho Markdown, và nâng cấp cơ chế lưu trữ bảng dưới dạng thẻ HTML để hỗ trợ merge cell, cell highlight, và background coloring.  
**Tài liệu tham chiếu:** [Báo cáo Đánh giá Sản phẩm (Feature Roast)](file:///Users/hudy/ws/depdok/docs/marketing/2-feature_roast.md)

---

## 1. Vấn đề Hiện tại

- **Side-by-Side cồng kềnh đối với Markdown:** Chế độ `side-by-side` dùng `react-resizable-panels` để render song song `MonacoEditor` + `PreviewPanel` trong `SideBySide/index.tsx`. Không có scroll-sync thực sự — chỉ là hai panel độc lập. Tốn tài nguyên vì cả hai trình soạn thảo nặng đều chạy cùng lúc đối với Markdown. Do đó, ta cần vô hiệu hóa chế độ này đối với file Markdown (`.md`).
- **Giữ lại codebase cho các file diagram:** Thay vì xóa hoàn toàn `SideBySide` khỏi codebase, ta chỉ tắt (disable) chế độ này đối với định dạng `.md` để tránh ảnh hưởng đến các loại file khác (ví dụ: `.npuml`/`.nplantuml` cần side-by-side).
- **Hạn chế Bảng Markdown:** Cú pháp `| col | col |` không hỗ trợ gộp ô, tô màu, hay merge cell.

---

## 2. Phân Tích Codebase — Side-by-Side Hiện Tại

### Danh sách toàn bộ nơi dùng `'side-by-side'`

| File | Dòng | Mô tả |
|------|------|--------|
| `src/stores/PaneStore.ts` | 7 | Type definition: `ViewMode = 'side-by-side' \| 'editor-only' \| 'preview-only'` |
| `src/stores/PaneStore.ts` | 120 | Default pane: `viewMode: initialSettings.viewMode \|\| 'side-by-side'` |
| `src/stores/PaneStore.ts` | 298 | Restore sau closePaneAtom: `viewMode: initialSettings.viewMode \|\| 'side-by-side'` |
| `src/stores/EditorStore.ts` | 25 | Fallback: `node?.type === 'leaf' ? node.pane.viewMode : 'side-by-side'` |
| `src/stores/SettingsStore.ts` | 27 | Type trong `viewModeSettingAtom` setter |
| `src/lib/settings.ts` | 4 | Type `AppSettings.viewMode` |
| `src/hooks/useProjectStateSync.ts` | 22 | `DEFAULT_VIEW_MODE = settingsService.getSettings().viewMode \|\| 'side-by-side'` |
| `src/features/EditorViewMode/index.tsx` | 10 | Button/item trong VIEW_MODES array |
| `src/features/EditorViewMode/index.tsx` | 15 | `logger: ["side-by-side", "preview-only"]` |
| `src/features/EditorViewMode/index.tsx` | 45 | Default fallback cho extensions không được định nghĩa |
| `src/features/EditorWorkspace/EditorPane.tsx` | 101 | `{pane.viewMode === 'side-by-side' && <SideBySide .../>}` |
| `src/features/Editor/EditorToolbar.tsx` | 21, 67, 69, 70 | Button "Side-by-side" với `Columns2` icon |
| `src/features/SidebySide/index.tsx` | — | **Toàn bộ file cần xóa** |

### File cần xóa hoàn toàn

- **`src/features/SidebySide/index.tsx`** — component render hai panel song song với `react-resizable-panels`

---

## 3. Giải Pháp

### A. Vô Hiệu Hóa `side-by-side` cho Markdown

Thay vì xóa code, ta chỉ tắt chế độ `side-by-side` đối với file Markdown (`.md`).

**Chiến lược vô hiệu hóa:**
- Cập nhật `EXTENSION_SUPPORTED_MODES` trong `src/features/EditorViewMode/index.tsx` để giới hạn các chế độ khả dụng cho `md`:
  ```typescript
  md: ["editor-only", "preview-only"]
  ```
- Khi mở file `.md`, giao diện `EditorViewMode` sẽ tự động lọc bỏ nút "Side by Side" và chỉ hiển thị 2 chế độ: "Editor Only" và "Preview Only".

### B. View Mode Toggle cho các File khác
- Các file có extension khác (chẳng hạn như `.npuml`/`.nplantuml`, `.logger`) vẫn có thể tiếp tục hỗ trợ `side-by-side` bình thường.
- Không cần xóa file `SidebySide/index.tsx` hay chỉnh sửa các fallback default của hệ thống.

### C. Lưu Trữ Bảng Dưới Dạng HTML trong File `.md`

Thay vì serialize bảng TipTap về cú pháp pipe (`| col |`), lưu trực tiếp dưới dạng HTML block:

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

**Khả năng tương thích:** CommonMark/GFM cho phép HTML block lồng trong Markdown. Bảng vẫn render đúng trên GitHub, VS Code, Obsidian.

**Bảng màu chuẩn hóa (fixed palette):**

| Màu | Hex | Ý nghĩa |
|-----|-----|---------|
| Xám nhạt | `#f3f4f6` | Header / neutral |
| Đỏ nhạt | `#fee2e2` | Cảnh báo / lỗi |
| Xanh nhạt | `#dcfce7` | Thành công / ok |
| Vàng nhạt | `#fef9c3` | Lưu ý / warning |
| Xanh dương nhạt | `#dbeafe` | Thông tin |

### D. Parser Bảo Toàn HTML Table

- Khi **đọc file**: Parser detect `<table>` block → nạp nguyên DOM vào TipTap Table Extension (không chuyển đổi về pipe syntax).
- Khi **lưu file**: TipTap serializer xuất `<table>` HTML thay vì `| col |`.
- Bảo toàn `rowspan`, `colspan`, `style` attribute khi round-trip.

---

## 4. Phạm Vi Thay Đổi Chi Tiết

### [MODIFY] Files cần sửa

#### `src/features/EditorViewMode/index.tsx`
- Cập nhật `EXTENSION_SUPPORTED_MODES` để chỉ định cụ thể các chế độ cho file `md`:
  ```typescript
  md: ["editor-only", "preview-only"]
  ```
- Đối với file Markdown, khi ở chế độ `side-by-side` (từ session cũ), component sẽ tự động chuyển đổi sang chế độ khả dụng đầu tiên (`editor-only`) nhờ cơ chế `useEffect` hiện có trong `EditorViewMode`.

---

## 5. Migration Guard — Tránh Crash Khi Upgrade

Người dùng cũ có thể đang lưu `viewMode: "side-by-side"` trong:
1. **`localStorage`** key `depdok-settings` → fix trong `settings.ts` `getSettings()`
2. **`sessionStorage`** key `depdok-pane-tree-v3` → fix khi hydrate `paneTreeAtom`

```typescript
// src/lib/settings.ts — trong getSettings()
const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
if (parsed.viewMode === 'side-by-side') {
  parsed.viewMode = 'editor-only'; // migrate legacy value
}
return parsed;

// src/stores/PaneStore.ts — sau khi load từ sessionStorage
function migratePaneTree(node: PaneNode): PaneNode {
  if (node.type === 'leaf') {
    return {
      ...node,
      pane: {
        ...node.pane,
        viewMode: node.pane.viewMode === 'side-by-side'
          ? 'editor-only'
          : node.pane.viewMode,
      },
    };
  }
  return { ...node, children: node.children.map(migratePaneTree) };
}
```

---

## 6. Phần Table — Chi Tiết TipTap Integration

### Hiện trạng TipTap trong codebase

`PreviewPanel` đang sử dụng TipTap (thấy qua `src/features/PreviewMarkdown`) với `@tiptap/extension-table`. Cần kiểm tra:
- `PreviewMarkdown` folder: xem TipTap extensions đang được configure như thế nào
- `EditorSaveHandler.tsx`: nơi serialize content về Markdown khi lưu file

### Thay đổi cần thiết cho Table Serializer

**Đọc file (Markdown → TipTap):**
- Parser phải detect `<table>...</table>` block trong Markdown
- Nạp nguyên HTML vào TipTap thay vì chuyển về internal JSON format
- Dùng `parseHTML()` trong TipTap extension để handle `style` attributes (`background-color`, `text-align`, `colspan`, `rowspan`)

**Lưu file (TipTap → Markdown):**
- Override `renderHTML()` / Markdown serializer của Table extension
- Xuất `<table>` HTML thay vì `| col |` pipe syntax
- Bảo toàn `colspan`, `rowspan`, inline `style` attributes

**UI Color Picker cho cell:**
- Thêm bubble menu (context menu) khi chọn cell trong TipTap
- Hiển thị 5 màu từ fixed palette + nút "Xóa màu"
- Dùng TipTap `setCellAttribute('backgroundColor', hex)` để set màu

---

## 7. Danh Sách Công Việc (Checklist)

### Phase 1: Vô Hiệu Hóa Side-by-Side Cho Markdown

- [ ] **`src/features/EditorViewMode/index.tsx`**: Cập nhật `EXTENSION_SUPPORTED_MODES` để giới hạn file `md` chỉ dùng `["editor-only", "preview-only"]`.
- [ ] Build `pnpm dev` → kiểm tra xem khi mở file `.md` thì nút "Side by Side" đã bị ẩn đi chưa và chuyển đổi chế độ xem có hoạt động mượt mà không.

### Phase 2: Table HTML Serialization

- [ ] Audit `src/features/PreviewMarkdown/` → xác định TipTap Table extension hiện tại đang configured thế nào
- [ ] Audit `src/features/Editor/EditorSaveHandler.tsx` → tìm điểm serialization TipTap → Markdown
- [ ] Override Table extension để serialize `<table>` HTML (không dùng pipe)
- [ ] Override input parser để đọc `<table>` HTML từ file `.md` vào TipTap nodes
- [ ] Thêm `colspan`, `rowspan`, `style` vào `addAttributes()` trong Table Cell extension
- [ ] Thêm Cell Color Picker vào bubble menu khi select cell

### Phase 3: Kiểm Thử Hồi Quy

- [ ] Mở file `.md` có bảng pipe cũ → xác nhận vẫn render đúng
- [ ] Tạo bảng mới với gộp ô (colspan/rowspan) → lưu → mở lại → verify định dạng bảo toàn
- [ ] Tô màu ô nền (5 màu palette) → lưu → mở lại → verify màu bảo toàn
- [ ] Mở file trên GitHub/VS Code → verify `<table>` HTML render đúng
- [ ] Test migration: mở app khi `localStorage` đang lưu `viewMode: "side-by-side"` → phải auto-migrate về `"editor-only"`
- [ ] Đảm bảo `logger` extension vẫn hoạt động đúng (mode mặc định `editor-only`)

---

## 8. Rủi Ro & Giải Pháp

| Rủi ro | Giải pháp |
|--------|-----------|
| TipTap serialize bảng HTML sẽ ghi đè bảng pipe cũ khi lưu | Chỉ dùng HTML serializer cho bảng **được tạo mới** hoặc **được chỉnh sửa qua TipTap**. Bảng pipe đọc vào TipTap → khi lưu → output HTML. Đây là hành vi mong muốn. |
| File `.md` chứa `<table>` HTML không render trong tool cũ | Chuẩn CommonMark/GFM support HTML block — hầu hết tool hiện đại support. Ghi chú trong docs. |
| User mở file có `<table>` phức tạp → TipTap parse sai | Kiểm tra edge case: nested tables, tables with `<caption>`, tables with no `<thead>`. Xử lý fallback: nếu parse lỗi, hiển thị HTML block dạng raw code. |
| `sessionStorage` bị stale sau khi xóa `side-by-side` | Migration guard trong `migratePaneTree()` đọc và convert toàn bộ tree. |
