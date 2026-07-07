# Markdown to PDF — Rust Solution

Convert a Markdown file to a styled A4 PDF using Rust, pulldown-cmark, and headless_chrome.

## How it works

1. **pulldown-cmark** parses the .md file into HTML
2. A CSS stylesheet is injected into the HTML (fonts, code blocks, headings, etc.)
3. The HTML is written to a temp .html file
4. **headless_chrome** loads the file in a headless Chrome browser and calls PrintToPDF
5. The temp file is deleted; the PDF is saved to disk

## Dependencies
[dependencies]
pulldown-cmark = "0.12"
headless_chrome = "1.0"
anyhow = "1"
clap = { version = "4", features = ["derive"] }
> **Requirement:** Google Chrome or Chromium must be installed. headless_chrome auto-detects it from the system path.

## Usage
# Output defaults to <input>.pdf
cargo run -- ai-workflow-solution.md

# Custom output path
cargo run -- input.md --output report.pdf

# Optimized release build
cargo build --release
./target/release/md-to-pdf input.md
## Key implementation notes

### 1. Temp file must have .html extension

Chrome determines content type from the file extension when loading via file:// URL.
Using .html.tmp causes Chrome to render raw HTML tags as plain text.
// Wrong — Chrome treats it as plain text
let tmp_html = output.with_extension("html.tmp");

// Correct — Chrome parses it as HTML
let tmp_html = output.with_extension("tmp.html");
### 2. Strip Windows UNC prefix from canonicalized paths

fs::canonicalize on Windows returns a \\?\ extended-length path which is not a valid file:// URL.
let abs_str = abs.to_string_lossy();
let abs_clean = abs_str.trim_start_matches(r"\\?\").replace('\\', "/");
let url = format!("file:///{abs_clean}");
### 3. Use @page margin instead of body padding

body { padding } only applies to the first page. @page { margin } is applied by Chrome's print engine to every page.
@page {
    margin: 40px 56px 50px 56px;
}
### 4. Page counter via footer_template

Chrome injects <span class="pageNumber"> and <span class="totalPages"> automatically when display_header_footer is enabled.
let footer = r#"<div style="width:100%;font-size:10px;color:#888;text-align:center;font-family:Arial,sans-serif;">
    <span class="pageNumber"></span> / <span class="totalPages"></span>
</div>"#;

PrintToPdfOptions {
    display_header_footer: Some(true),
    header_template: Some("<span></span>".to_string()), // empty but required
    footer_template: Some(footer.to_string()),
    margin_bottom: Some(0.4), // space for the footer
    ..Default::default()
}
## Full source — src/main.rs

`rust
use anyhow::{Context, Result};
use clap::Parser;
use headless_chrome::{Browser, LaunchOptions, types::PrintToPdfOptions};
use pulldown_cmark::{html, Options, Parser as MdParser};
use std::{fs, path::PathBuf};

#[derive(Parser)]
#[command(about = "Convert a Markdown file to PDF")]
struct Args {
    input: PathBuf,
    #[arg(short, long)]
    output: Option<PathBuf>,
}

const CSS: &str = r#"
    @page {
        margin: 40px 56px 50px 56px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
        font-family: 'Segoe UI', Arial, sans-serif;
        font-size: 13px;
        line-height: 1.7;
        color: #1a1a1a;
    }
    h1, h2, h3, h4, h5, h6 { margin: 1.4em 0 0.5em; font-weight: 600; line-height: 1.3; }
    h1 { font-size: 2em; border-bottom: 2px solid #e0e0e0; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #e0e0e0; padding-bottom: 0.2em; }
    h3 { font-size: 1.2em; }
    p { margin: 0.7em 0; }
    ul, ol { margin: 0.5em 0 0.5em 1.8em; }
    li { margin: 0.25em 0; }
    code {
        background: #f4f4f4;
        border-radius: 3px;
        padding: 0.1em 0.4em;
 ont-family: 'Consolas', 'Courier New', monospace;
        font-size: 0.9em;
    }
    pre {
        background: #f6f8fa;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        padding: 16px;
        margin: 0.8em 0;
    }
    pre code { background: none; padding: 0; font-size: 0.88em; }
    blockquote { border-left: 4px solid #d0d7de; padding: 0.3em 1em; color: #555; margin: 0.8em 0; }
    table { border-collapse: collapse; width: 100%; margin: 0.8em 0; }
    th, td { border: 1px solid #d0d7de; padding: 6px 12px; text-align: left; }
    th { background: #f6f8fa; font-weight: 600; }
    hr { border: none; border-top: 1px solid #e0e0e0; margin: 1.5em 0; }
    a { color: #0969da; text-decoration: none; }
"#;

fn markdown_to_html(md: &str) -> String {
    let mut opts = Options::empty();
    opts.insert(Options::ENABLE_TABLES);
    opts.insert(Options::ENABLE_STRIKETHROUGH);
    opts.insert(Options::ENABLE_TASKLISTS);
    let parser = MdParser::new_ext(md, opts);
    let mut body = String::new();
    html::push_html(&mut body, parser);
    format!(r#"<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>{CSS}</style></head>
<body>{body}</body></html>"#)
}

fn html_to_pdf(html: &str, output: &PathBuf) -> Result<()> {
    let tmp_html = output.with_extension("tmp.html");
    fs::write(&tmp_html, html).context("write temp HTML")?;

    let abs = fs::canonicalize(&tmp_html).context("canonicalize temp HTML path")?;
    let abs_str = abs.to_string_lossy();
    let abs_clean = abs_str.trim_start_matches(r"\\?\").replace('\\', "/");
    let url = format!("file:///{abs_clean}");

    let browser = Browser::new(
        LaunchOptions::default_builder().headless(true).build().unwrap(),
    ).context("launch Chrome")?;

    let tab = browser.new_tab().context("open tab")?;
    tab.navigate_to(&url).context("navigate to HTML")?;
    tab.wait_until_navigated().context("wait for page load")?;
    tab.wait_for_element("body").context("wait for body")?;

    let footer = r#"<div style="width:100%;font-size:10px;color:#888;text-align:center;font-family:Arial,sans-serif;">
        <span class="pageNumber"></span> / <span class="totalPages"></span>
    </div>"#;

    let pdf_data = tab.print_to_pdf(Some(PrintToPdfOptions {
        landscape: Some(false),
        print_background: Some(true),
        margin_top: Some(0.0),
        margin_bottom: Some(0.4),
        margin_left: Some(0.0),
        margin_right: Some(0.0),
        paper_width: Some(8.27),
        paper_height: Some(11.69),
        scale: Some(1.0),
        display_header_footer: Some(true),
        header_template: Some("<span></span>".to_string()),
        footer_template: Some(footer.to_string()),
        ..Default::default()
    })).context("print to PDF")?;

    fs::write(output, pdf_data).context("write PDF")?;
    fs::remove_file(&tmp_html).ok();
    Ok(())
}

fn main() -> Result<()> {
    let args = Args::parse();
    let output = args.output.unwrap_or_else(|| args.input.with_extension("pdf"));
    let md = fs::read_to_string(&args.input)
        .with_context(|| format!("read {}", args.input.display()))?;
    println!("Converting {} -> {}", args.input.display(), output.display());
    let html = markdown_to_html(&md);
    html_to_pdf(&html, &output)?;
    println!("Done: {}", output.display());
    Ok(())
}
```
