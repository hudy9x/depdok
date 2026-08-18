# Spreadsheet (.xlsx & .csv) Extension Architecture & Feature Guide

Depdok features a fully-featured, Excel/Google Sheets-like spreadsheet viewer and editor for `.xlsx` (Microsoft Excel) and `.csv` (Comma-Separated Values) files. It includes a reactive UI, formula engine, rich cell formatting, multi-sheet workbook support, and a headless command-driven SDK designed for UI interactions and MCP (Model Context Protocol) agent tools.

---

## 1. Directory & File Structure

All spreadsheet frontend components, core engines, and types are co-located in `src/features/PreviewXlsx/`:

```
src/features/PreviewXlsx/
├── components/
│   ├── CellEditor.tsx           # Inline cell editor overlay with direct typing
│   ├── FormulaBar.tsx           # Name Box (coordinate jump) + fx formula bar
│   ├── SheetTabBar.tsx          # Bottom multi-sheet tabs (Add, Rename, Delete)
│   ├── SpreadsheetGrid.tsx      # Main virtualized grid, selection box, headers, & context menus
│   └── Toolbar.tsx              # Formatting toolbar (styles, num formats, undo/redo)
├── core/
│   ├── formulaEngine.ts         # Excel formula evaluation engine with cell/range resolution
│   ├── numberFormatter.ts      # Number/Date/Currency formatters and coordinate math (A1 <-> {r, c})
│   ├── spreadsheetSdk.ts        # Command-driven SDK & headless spreadsheet engine
│   ├── types.ts                 # Workbook, Sheet, Cell, Style, and Command type definitions
│   └── xlsxSerializer.ts        # SheetJS (xlsx) parser and exporter for XLSX & CSV
├── hooks/
│   └── useSpreadsheetHistory.ts # Undo / Redo history stack management
├── styles/
│   └── spreadsheet.css          # Excel-like grid styles, light/dark themes, selection box
├── XlsxPreview.tsx              # Main spreadsheet feature wrapper
└── index.ts                     # Public feature exports
```

---

## 2. Core Capabilities & Features

### 2.1 File Format Support
- **`.xlsx`**: Microsoft Excel OpenXML binary spreadsheets. Reads and writes binary buffers with full cell metadata, formulas, data types, formats, custom column widths, and row heights.
- **`.csv`**: Plain text Comma-Separated Values. Reads and writes standard UTF-8 text with multi-line parsing and cell-grid synchronization.

### 2.2 Built-in Formula Engine (`formulaEngine.ts`)
Formulas begin with `=` (e.g. `=SUM(A1:A10)`) and support cell coordinates (`B2`), 2D ranges (`A1:C5`), arithmetic operators (`+`, `-`, `*`, `/`, `^`, `%`), string concatenation (`&`), and comparison operators (`=`, `<>`, `<`, `>`, `<=`, `>=`).

Supported functions include:
- **Math & Arithmetic**: `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `COUNTA`, `COUNTBLANK`, `ROUND`, `ROUNDUP`, `ROUNDDOWN`, `ABS`, `SQRT`, `POWER`, `PRODUCT`, `MOD`, `INT`.
- **Logic & Flow**: `IF`, `AND`, `OR`, `NOT`, `IFERROR`.
- **Text & String**: `CONCAT`, `CONCATENATE`, `LEFT`, `RIGHT`, `MID`, `LEN`, `UPPER`, `LOWER`, `PROPER`, `TRIM`, `TEXT`.
- **Date & Time**: `TODAY`, `NOW`, `DATE`, `YEAR`, `MONTH`, `DAY`.

### 2.3 Number Formatting (`numberFormatter.ts`)
Supports cell-level format strings:
- **General**: Default auto-formatting.
- **Number**: `#,##0.00` / `0.00` decimal formatting.
- **Currency**: `$#,##0.00` with commas and currency symbols.
- **Percentage**: `0.0%` / `0.00%`.
- **Date**: `YYYY-MM-DD`, `MM/DD/YYYY`.
- **Plain Text**: `@` (prevents numeric/formula interpretation).

### 2.4 Command-Driven Spreadsheet SDK (`spreadsheetSdk.ts`)
Every modification to the workbook is processed through `SpreadsheetSDK.executeCommand()`. This provides atomic, predictable state transitions, undo/redo snapshots, and headless execution for MCP tools:

```typescript
export type SpreadsheetCommand =
  | { type: 'SET_CELL_VALUE'; sheet?: string; cell: string; value: CellValue }
  | { type: 'SET_CELL_FORMULA'; sheet?: string; cell: string; formula: string }
  | { type: 'SET_CELL_STYLE'; sheet?: string; range: string; style: Partial<CellStyle> }
  | { type: 'SET_CELL_FORMAT'; sheet?: string; range: string; numFmt: string }
  | { type: 'SET_RANGE_DATA'; sheet?: string; startCell: string; data: CellValue[][] }
  | { type: 'CLEAR_RANGE'; sheet?: string; range: string; clearStyles?: boolean }
  | { type: 'ADD_SHEET'; name?: string }
  | { type: 'DELETE_SHEET'; name: string }
  | { type: 'RENAME_SHEET'; oldName: string; newName: string }
  | { type: 'SET_ACTIVE_SHEET'; name: string }
  | { type: 'INSERT_ROW'; sheet?: string; rowIndex: number }
  | { type: 'DELETE_ROW'; sheet?: string; rowIndex: number }
  | { type: 'INSERT_COL'; sheet?: string; colIndex: number }
  | { type: 'DELETE_COL'; sheet?: string; colIndex: number }
  | { type: 'SET_COL_WIDTH'; sheet?: string; colIndex: number; width: number }
  | { type: 'SET_ROW_HEIGHT'; sheet?: string; rowIndex: number; height: number };
```

---

## 3. UI & User Interactions

### 3.1 Formula Bar (`FormulaBar.tsx`)
- **Name Box**: Shows active cell coordinate (e.g. `C5`). Typing a valid address (e.g. `F12`) and pressing `Enter` jumps the selection immediately.
- **`fx` Formula Input**: Live two-way synchronization with cell content and formula editing.

### 3.2 Toolbar (`Toolbar.tsx`)
- **Undo / Redo** (`Cmd+Z` / `Cmd+Y`).
- **Typography & Colors**: Bold (`Cmd+B`), Italic (`Cmd+I`), Underline (`Cmd+U`), Strikethrough, Text Color Picker, Cell Background / Fill Color Picker.
- **Alignment**: Text align left, center, right.
- **Number Formats**: Quick dropdown for General, Number, Currency, Percentage, Date, Plain Text.
- **Row & Column Helpers**: Insert row above/below, delete row, insert column left/right, delete column, clear cells.

### 3.3 Interactive Grid (`SpreadsheetGrid.tsx`)
- **Sticky Headers**: Sticky row headers (`1-N`) and column headers (`A-Z`) with active selection highlights in blue.
- **Selection Overlay**: Blue bounding box with bottom-right fill handle.
- **Keyboard Navigation**:
  - `ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight`: Move active cell with automatic viewport scrolling.
  - `Shift + Arrows`: Expand selection range.
  - `Tab` / `Shift+Tab`: Navigate across columns.
  - `Enter` / `Shift+Enter`: Navigate down/up rows.
  - `F2` or Direct Typing: Immediately opens the inline editor with zero character duplication or latency.
  - `Delete` / `Backspace`: Clears selected cell range.

### 3.4 Context Menus
- **Column Header Right-Click**:
  - Cut (`⌘X`), Copy (`⌘C`), Paste (`⌘V`), Paste special (Values only)
  - Insert 1 column left / Insert 1 column right
  - Delete column (destructive)
  - Clear column
  - Hide column
- **Row Header Right-Click**:
  - Cut (`⌘X`), Copy (`⌘C`), Paste (`⌘V`), Paste special (Values only)
  - Insert 1 row above / Insert 1 row below
  - Delete row (destructive)
  - Clear row
- **Cell / Range Right-Click**:
  - Cut (`⌘X`), Copy (`⌘C`), Paste (`⌘V`), Paste special (Values only)
  - **Format cells** submenu: Number (`0.00`), Text (`@`), Date (`YYYY-MM-DD`), Link (hyperlink styling), Currency (`$#,##0.00`), Percentage (`0.0%`)
  - Clear contents

### 3.5 Sheet Tab Bar (`SheetTabBar.tsx`)
- Multi-sheet tab navigation at the bottom.
- `+` button to create new sheets.
- Context menu on sheet tabs: Rename, Duplicate, Delete.

---

## 4. File System Integration & Saving

1. **File Type Detection**:
   - Registered in `src/lib/fileSupport.ts` under `CUSTOM_PREVIEW_EXTENSIONS` (`xlsx`, `csv`).
   - Configured in `src/features/EditorViewMode/index.tsx` as `["editor-only", "preview-only"]` for CSV and `["preview-only"]` for XLSX.
2. **File Loading**:
   - `XlsxPreview.tsx` loads binary array buffers or plain text CSV via `@tauri-apps/plugin-fs` / Rust `read_file_content`.
3. **Saving Changes**:
   - `src/features/Editor/EditorSaveHandler.tsx` intercepts `save-file` events.
   - For `.xlsx`: Serializes the workbook to binary buffer and writes to disk.
   - For `.csv`: Serializes the active sheet to plain text CSV string and writes via `writeFileContent`.
