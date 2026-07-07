use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use headless_chrome::{Browser, LaunchOptions, types::PrintToPdfOptions};
use pulldown_cmark::{html, Options, Parser as MdParser};
use tauri_plugin_dialog::DialogExt;
use tauri::Manager;
use crate::commands::file_watcher::FileWatcher;

fn get_unique_path(base_path: &Path, ext: &str) -> PathBuf {
    let path = base_path.with_extension(ext);
    if !path.exists() {
        return path;
    }
    let parent = base_path.parent().unwrap_or_else(|| Path::new(""));
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

const CSS: &str = r#"
@page {
    margin: 20mm 20mm 20mm 20mm;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    color: #24292f;
    background-color: #f6f8fa;
    padding: 40px 20px;
    display: flex;
    justify-content: center;
}
.document-wrapper {
    background-color: #ffffff;
    border: 1px solid #d0d7de;
    border-radius: 8px;
    padding: 48px;
    width: 100%;
    max-width: 850px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}
@media print {
    body {
        background-color: #ffffff;
        padding: 0;
        display: block;
    }
    .document-wrapper {
        border: none;
        border-radius: 0;
        padding: 0;
        max-width: none;
        box-shadow: none;
    }
}
h1, h2, h3, h4, h5, h6 { 
    margin-top: 24px; 
    margin-bottom: 16px; 
    font-weight: 600; 
    line-height: 1.25; 
    color: #1f2328;
    page-break-after: avoid;
}
h1 { font-size: 2em; border-bottom: 1px solid #d8dee4; padding-bottom: 0.3em; }
h2 { font-size: 1.5em; border-bottom: 1px solid #d8dee4; padding-bottom: 0.3em; }
h3 { font-size: 1.25em; }
h4 { font-size: 1em; }
p { margin-top: 0; margin-bottom: 16px; }
ul, ol { margin-top: 0; margin-bottom: 16px; padding-left: 2em; }
li { margin: 0.25em 0; }
code {
    background-color: rgba(175, 184, 193, 0.2);
    border-radius: 6px;
    padding: 0.2em 0.4em;
    font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
    font-size: 85%;
}
pre {
    background-color: #f6f8fa;
    border-radius: 6px;
    padding: 16px;
    margin-top: 0;
    margin-bottom: 16px;
    overflow: auto;
    font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
    font-size: 85%;
    line-height: 1.45;
    page-break-inside: avoid;
}
pre code { background: none; padding: 0; font-size: 100%; border-radius: 0; }
blockquote { 
    border-left: 4px solid #d0d7de; 
    padding: 0 1em; 
    color: #57606a; 
    margin-top: 0;
    margin-bottom: 16px; 
}
table { 
    border-collapse: collapse; 
    width: 100%; 
    margin-top: 0;
    margin-bottom: 16px; 
    page-break-inside: avoid;
}
th, td { border: 1px solid #d0d7de; padding: 6px 13px; text-align: left; }
th { background-color: #f6f8fa; font-weight: 600; }
hr { border: none; border-bottom: 2px solid #d8dee4; margin: 24px 0; height: 0; padding: 0; }
a { color: #0969da; text-decoration: none; }
a:hover { text-decoration: underline; }
.mermaid {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 24px 0;
    width: 100%;
    overflow: visible;
    page-break-inside: avoid;
    background-color: transparent;
}
.mermaid svg {
    max-width: 100% !important;
    max-height: 180mm !important;
    height: auto !important;
    width: auto !important;
}
"#;

fn markdown_to_html(md: &str) -> String {
    let mut opts = Options::empty();
    opts.insert(Options::ENABLE_TABLES);
    opts.insert(Options::ENABLE_STRIKETHROUGH);
    opts.insert(Options::ENABLE_TASKLISTS);
    let parser = MdParser::new_ext(md, opts);
    let mut body = String::new();
    html::push_html(&mut body, parser);
    format!(
        r#"<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>{}</style>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github.min.css">
<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
</head>
<body>
<div class="document-wrapper">
{}
</div>
<script>
  async function initRendering() {{
    // 1. Highlight all non-mermaid code blocks
    if (typeof hljs !== 'undefined') {{
      try {{
        const codeBlocks = document.querySelectorAll('pre code:not(.language-mermaid)');
        codeBlocks.forEach((block) => {{
          hljs.highlightElement(block);
        }});
      }} catch (e) {{
        console.error('Failed to run Highlight.js:', e);
      }}
    }}

    // 2. Render Mermaid diagrams
    const mermaidBlocks = document.querySelectorAll('pre code.language-mermaid');
    if (mermaidBlocks.length === 0) {{
      finish();
      return;
    }}

    if (typeof mermaid === 'undefined') {{
      console.warn('Mermaid library not loaded (possibly offline). Leaving raw code blocks.');
      finish();
      return;
    }}

    try {{
      mermaid.initialize({{
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
      }});

      for (let i = 0; i < mermaidBlocks.length; i++) {{
        const codeBlock = mermaidBlocks[i];
        const preBlock = codeBlock.parentElement;
        if (!preBlock) continue;

        const code = codeBlock.textContent;
        const container = document.createElement('div');
        container.className = 'mermaid';
        container.textContent = code;
        
        preBlock.parentNode.replaceChild(container, preBlock);
      }}

      await mermaid.run();
    }} catch (e) {{
      console.error('Failed to render Mermaid diagrams:', e);
    }} finally {{
      finish();
    }}
  }}

  function finish() {{
    const indicator = document.createElement('div');
    indicator.id = 'rendering-complete';
    indicator.style.display = 'none';
    document.body.appendChild(indicator);
  }}

  if (document.readyState === 'complete' || document.readyState === 'interactive') {{
    initRendering();
  }} else {{
    document.addEventListener('DOMContentLoaded', initRendering);
  }}
</script>
</body>
</html>"#,
        CSS, body
    )
}

#[tauri::command]
pub async fn export_markdown_to_html(
    app: tauri::AppHandle,
    markdown: String,
    file_path: Option<String>,
) -> Result<String, String> {
    println!("[Export Backend] export_markdown_to_html called with file_path={:?}, md_len={}", file_path, markdown.len());

    let dest_path = match file_path {
        Some(path_str) => {
            let p = Path::new(&path_str);
            let unique = get_unique_path(p, "html");
            println!("[Export Backend] source path was provided, determined unique path: {:?}", unique);
            unique
        }
        None => {
            println!("[Export Backend] no source path, opening blocking save file dialog...");
            let selected_path = app.dialog()
                .file()
                .add_filter("HTML Document", &["html"])
                .blocking_save_file();
            
            match selected_path {
                Some(path) => {
                    let p = path.as_path().unwrap();
                    let unique = get_unique_path(p, "html");
                    println!("[Export Backend] path chosen from dialog, determined unique path: {:?}", unique);
                    unique
                }
                None => {
                    println!("[Export Backend] save dialog cancelled by user");
                    return Err("Export cancelled by user".to_string());
                }
            }
        }
    };

    let html_content = markdown_to_html(&markdown);
    println!("[Export Backend] generated HTML content, length={}", html_content.len());

    let dest_path_str = dest_path.to_string_lossy().to_string();
    if let Some(file_watcher) = app.try_state::<FileWatcher>() {
        file_watcher.ignore_path(dest_path_str.clone());
        let ignored_paths_clone = Arc::clone(&file_watcher.ignored_paths);
        let dest_path_str_clone = dest_path_str.clone();
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            if let Ok(mut ignored) = ignored_paths_clone.lock() {
                ignored.remove(&dest_path_str_clone);
            }
        });
    }

    fs::write(&dest_path, html_content)
        .map_err(|e| {
            let err_msg = format!("Failed to write HTML file: {}", e);
            eprintln!("[Export Backend] error: {}", err_msg);
            err_msg
        })?;

    let final_path = dest_path.to_string_lossy().to_string();
    println!("[Export Backend] successfully wrote HTML file to {}", final_path);
    Ok(final_path)
}

#[tauri::command]
pub async fn export_markdown_to_pdf(
    app: tauri::AppHandle,
    markdown: String,
    file_path: Option<String>,
) -> Result<String, String> {
    println!("[Export Backend] export_markdown_to_pdf called with file_path={:?}, md_len={}", file_path, markdown.len());

    let dest_path = match file_path {
        Some(path_str) => {
            let p = Path::new(&path_str);
            let unique = get_unique_path(p, "pdf");
            println!("[Export Backend] source path was provided, determined unique path: {:?}", unique);
            unique
        }
        None => {
            println!("[Export Backend] no source path, opening blocking save file dialog...");
            let selected_path = app.dialog()
                .file()
                .add_filter("PDF Document", &["pdf"])
                .blocking_save_file();
            
            match selected_path {
                Some(path) => {
                    let p = path.as_path().unwrap();
                    let unique = get_unique_path(p, "pdf");
                    println!("[Export Backend] path chosen from dialog, determined unique path: {:?}", unique);
                    unique
                }
                None => {
                    println!("[Export Backend] save dialog cancelled by user");
                    return Err("Export cancelled by user".to_string());
                }
            }
        }
    };

    let html_content = markdown_to_html(&markdown);
    println!("[Export Backend] generated HTML content, length={}", html_content.len());

    // Place the temp HTML file in the markdown file's directory if it exists,
    // so relative image links resolve correctly during Chrome render.
    let temp_dir = dest_path.parent().unwrap_or_else(|| Path::new("."));
    let temp_html_path = temp_dir.join(".export_temp.tmp.html");
    println!("[Export Backend] writing temporary HTML file to {:?}", temp_html_path);

    let dest_path_str = dest_path.to_string_lossy().to_string();
    let temp_html_path_str = temp_html_path.to_string_lossy().to_string();
    if let Some(file_watcher) = app.try_state::<FileWatcher>() {
        file_watcher.ignore_path(dest_path_str.clone());
        file_watcher.ignore_path(temp_html_path_str.clone());
        
        let ignored_paths_clone = Arc::clone(&file_watcher.ignored_paths);
        let dest_path_str_clone = dest_path_str.clone();
        let temp_html_path_str_clone = temp_html_path_str.clone();
        
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            if let Ok(mut ignored) = ignored_paths_clone.lock() {
                ignored.remove(&dest_path_str_clone);
                ignored.remove(&temp_html_path_str_clone);
            }
        });
    }

    fs::write(&temp_html_path, html_content)
        .map_err(|e| {
            let err_msg = format!("Failed to write temporary HTML file: {}", e);
            eprintln!("[Export Backend] error: {}", err_msg);
            err_msg
        })?;

    // Canonicalize the path and create a file:// URL
    let abs_path = fs::canonicalize(&temp_html_path)
        .map_err(|e| {
            let err_msg = format!("Failed to canonicalize temp HTML path: {}", e);
            eprintln!("[Export Backend] error: {}", err_msg);
            let _ = fs::remove_file(&temp_html_path);
            err_msg
        })?;
    let abs_str = abs_path.to_string_lossy();
    let abs_clean = abs_str.trim_start_matches(r"\\?\").replace('\\', "/");
    let url = format!("file:///{}", abs_clean);
    println!("[Export Backend] generated file URL: {}", url);

    let result = (|| -> Result<(), String> {
        println!("[Export Backend] launching headless browser...");
        let browser = Browser::new(
            LaunchOptions::default_builder()
                .headless(true)
                .build()
                .map_err(|e| format!("Failed to launch Chromium: {}", e))?,
        )
        .map_err(|e| format!("Failed to initialize headless browser: {}", e))?;

        println!("[Export Backend] opening new browser tab...");
        let tab = browser
            .new_tab()
            .map_err(|e| format!("Failed to open browser tab: {}", e))?;

        println!("[Export Backend] navigating tab to {}", url);
        tab.navigate_to(&url)
            .map_err(|e| format!("Failed to navigate to temporary URL: {}", e))?;

        println!("[Export Backend] waiting for page navigation...");
        tab.wait_until_navigated()
            .map_err(|e| format!("Failed waiting for page navigation: {}", e))?;

        println!("[Export Backend] waiting for body element...");
        tab.wait_for_element("body")
            .map_err(|e| format!("Body element not loaded: {}", e))?;

        println!("[Export Backend] waiting for Mermaid rendering to complete...");
        tab.wait_for_element("#rendering-complete")
            .map_err(|e| format!("Mermaid rendering timed out or failed: {}", e))?;

        let footer = r#"<div style="width:100%;font-size:9px;color:#888;text-align:center;font-family:Arial,sans-serif;">
            <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>"#;

        println!("[Export Backend] executing print_to_pdf...");
        let pdf_data = tab
            .print_to_pdf(Some(PrintToPdfOptions {
                landscape: Some(false),
                print_background: Some(true),
                margin_top: Some(0.4),
                margin_bottom: Some(0.6),
                margin_left: Some(0.4),
                margin_right: Some(0.4),
                paper_width: Some(8.27),  // A4 Width in inches
                paper_height: Some(11.69), // A4 Height in inches
                scale: Some(1.0),
                display_header_footer: Some(true),
                header_template: Some("<span></span>".to_string()),
                footer_template: Some(footer.to_string()),
                ..Default::default()
            }))
            .map_err(|e| format!("PrintToPDF execution failed: {}", e))?;

        println!("[Export Backend] writing final PDF file to {:?}", dest_path);
        fs::write(&dest_path, pdf_data)
            .map_err(|e| format!("Failed to write final PDF document: {}", e))?;

        Ok(())
    })();

    // Always clean up the temporary HTML file
    println!("[Export Backend] cleaning up temporary HTML file {:?}", temp_html_path);
    let _ = fs::remove_file(&temp_html_path);

    result.map_err(|e| {
        eprintln!("[Export Backend] error during PDF generation: {}", e);
        e
    })?;

    let final_path = dest_path.to_string_lossy().to_string();
    println!("[Export Backend] successfully wrote PDF file to {}", final_path);
    Ok(final_path)
}
