# Markdown to PDF & HTML Export Plan

Convert a Markdown file to a styled A4 PDF or standard HTML document from the editor's bottom menu in the Tauri application.

## How it works

1. **pulldown-cmark** parses the TipTap editor's Markdown content into HTML.
2. An elegant, print-oriented CSS stylesheet is injected into the HTML.
3. If exporting to HTML:
   - Determine unique destination path.
   - Write styled HTML directly to disk.
4. If exporting to PDF:
   - Determine unique destination path.
   - Write HTML to a temporary `.tmp.html` file in the same directory as the source Markdown file (ensuring relative image references resolve correctly).
   - **headless_chrome** loads the temporary HTML file via a file URL and calls `PrintToPDF` inside a headless Chromium instance.
   - Write the PDF bytes to the destination path.
   - Delete the temporary HTML file.

## Backend Dependencies

Add the following crate to `src-tauri/Cargo.toml`:
```toml
[dependencies]
headless_chrome = { version = "1.0.0", default-features = false }
pulldown-cmark = { version = "0.12", default-features = false }
```

## Unique Filename Resolving

If the target exported file already exists, we automatically append a counter suffix `(n)` before the file extension to prevent overwriting existing files:

```rust
fn get_unique_path(base_path: &std::path::Path, ext: &str) -> std::path::PathBuf {
    let mut path = base_path.with_extension(ext);
    if !path.exists() {
        return path;
    }
    let parent = base_path.parent().unwrap_or_else(|| std::path::Path::new(""));
    let stem = base_path.file_stem().and_then(|s| s.to_str()).unwrap_or("document");
    let mut counter = 1;
    loop {
        let new_name = format!("{} ({})", stem, counter);
        let new_path = parent.join(new_name).with_extension(ext);
        if !new_path.exists() {
            return new_path;
        }
        counter += 1;
    }
}
```

## Tauri Commands — Rust

### 1. Export Markdown to HTML
```rust
#[tauri::command]
pub async fn export_markdown_to_html(
    app: tauri::AppHandle,
    markdown: String,
    file_path: Option<String>,
) -> Result<String, String>
```

### 2. Export Markdown to PDF
```rust
#[tauri::command]
pub async fn export_markdown_to_pdf(
    app: tauri::AppHandle,
    markdown: String,
    file_path: Option<String>,
) -> Result<String, String>
```
If `file_path` is `None` (untitled document), we prompt the user with a blocking save dialog:
```rust
let selected_path = app.dialog()
    .file()
    .add_filter("PDF Document", &["pdf"]) // or HTML
    .blocking_save_file();
```

## Frontend Integration

### Export Trigger (Bottom Menu)
In [MarkdownBottomMenu.tsx](file:///Users/hudy/ws/depdok/src/features/PreviewMarkdown/MarkdownBottomMenu.tsx), we add an **Export** button.
It opens a popover styled using the Shadcn Popover component.

```tsx
export function ExportButton({ editor, filePath }: { editor: Editor; filePath?: string }) {
  const [open, setOpen] = useState(false);

  const handleExport = async (format: "pdf" | "html") => {
    // 1. Get markdown from editor
    const markdown = editor.getMarkdown();
    // 2. Call Tauri command (export_markdown_to_pdf / export_markdown_to_html)
    // 3. Show sonner loading toast, and success toast with action to "Open Folder"
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="p-2 rounded hover:bg-accent text-xs flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1.5 flex flex-col gap-1" align="end">
        <button onClick={() => handleExport("pdf")} className="w-full text-left px-2 py-1.5 rounded hover:bg-accent flex items-start gap-2">
          <FileType className="w-4 h-4 text-red-500" />
          <div>
            <div className="font-medium text-foreground">Export as PDF</div>
            <div className="text-[10px] text-muted-foreground">Standard A4 document</div>
          </div>
        </button>
        <button onClick={() => handleExport("html")} className="w-full text-left px-2 py-1.5 rounded hover:bg-accent flex items-start gap-2">
          <FileCode className="w-4 h-4 text-blue-500" />
          <div>
            <div className="font-medium text-foreground">Export as HTML</div>
            <div className="text-[10px] text-muted-foreground">Web document</div>
          </div>
        </button>
      </PopoverContent>
    </Popover>
  );
}
```
