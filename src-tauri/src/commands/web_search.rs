use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSearchResultItem {
    pub title: String,
    pub snippet: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSearchResult {
    pub query: String,
    pub total_found: usize,
    pub results: Vec<WebSearchResultItem>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebPageResult {
    pub url: String,
    pub title: String,
    pub content: String,
    pub character_count: usize,
    pub truncated: bool,
}

fn extract_yahoo_url(redirect_url: &str) -> String {
    if let Some(ru_pos) = redirect_url.find("/RU=") {
        let ru_start = ru_pos + 4;
        let rest = &redirect_url[ru_start..];
        let end_pos = rest.find('/').unwrap_or(rest.len());
        let encoded_url = &rest[..end_pos];
        if let Ok(decoded) = urlencoding::decode(encoded_url) {
            return decoded.into_owned();
        }
    }
    redirect_url.to_string()
}

/// Scrape Yahoo Search endpoint asynchronously for search results.
pub async fn search_yahoo_async(query: &str, limit: usize) -> Result<WebSearchResult, String> {
    let trimmed_query = query.trim();
    if trimmed_query.is_empty() {
        return Err("Search query cannot be empty".to_string());
    }

    let search_url = format!(
        "https://search.yahoo.com/search?p={}",
        urlencoding::encode(trimmed_query)
    );

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let response = client
        .get(&search_url)
        .send()
        .await
        .map_err(|e| format!("Web search request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Search request returned status: {}", response.status()));
    }

    let html = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    let document = Html::parse_document(&html);
    let algo_sel = Selector::parse(".algo").map_err(|e| format!("Invalid selector: {:?}", e))?;
    let title_sel = Selector::parse(".title").map_err(|e| format!("Invalid selector: {:?}", e))?;
    let snippet_sel = Selector::parse(".compText").map_err(|e| format!("Invalid selector: {:?}", e))?;
    let link_sel = Selector::parse(".compTitle a").map_err(|e| format!("Invalid selector: {:?}", e))?;

    let max_results = limit.clamp(1, 10);
    let mut results = Vec::new();

    for (i, result) in document.select(&algo_sel).enumerate() {
        if i >= max_results {
            break;
        }

        let title = result
            .select(&title_sel)
            .next()
            .map(|e| e.text().collect::<String>().trim().to_string())
            .unwrap_or_default();

        let snippet = result
            .select(&snippet_sel)
            .next()
            .map(|e| e.text().collect::<String>().trim().to_string())
            .unwrap_or_default();

        let redirect_url = result
            .select(&link_sel)
            .next()
            .and_then(|a| a.value().attr("href"))
            .unwrap_or_default();

        let decoded_url = extract_yahoo_url(redirect_url);

        if !title.is_empty() || !snippet.is_empty() {
            results.push(WebSearchResultItem {
                title,
                snippet,
                url: decoded_url,
            });
        }
    }

    let total = results.len();
    let message = if total == 0 {
        Some("No matching search results found. Try refining the query keywords.".to_string())
    } else {
        None
    };

    Ok(WebSearchResult {
        query: trimmed_query.to_string(),
        total_found: total,
        results,
        message,
    })
}

/// Fetch a webpage and extract clean readable text/markdown, stripping HTML noise.
pub async fn fetch_web_page_async(url: &str) -> Result<WebPageResult, String> {
    let trimmed_url = url.trim();
    if trimmed_url.is_empty() {
        return Err("URL cannot be empty".to_string());
    }

    if !trimmed_url.starts_with("http://") && !trimmed_url.starts_with("https://") {
        return Err("URL must start with http:// or https://".to_string());
    }

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let response = client
        .get(trimmed_url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch URL '{}': {}", trimmed_url, e))?;

    let status = response.status();
    if !status.is_success() && !status.is_redirection() {
        return Err(format!("Web request failed with HTTP status {}", status));
    }

    let html_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read webpage content: {}", e))?;

    let document = Html::parse_document(&html_text);

    // Extract title
    let title_sel = Selector::parse("title").ok();
    let title = title_sel
        .and_then(|sel| document.select(&sel).next())
        .map(|e| e.text().collect::<String>().trim().to_string())
        .unwrap_or_else(|| "Web Page".to_string());

    // Select main content if available, fallback to body
    let article_sel = Selector::parse("article, main, .content, #content, body").ok();
    let root_elem = article_sel
        .and_then(|sel| document.select(&sel).next())
        .map(|e| Html::parse_fragment(&e.html()))
        .unwrap_or_else(|| Html::parse_fragment(&html_text));

    // Extract textual elements (h1, h2, h3, p, li, pre, code)
    let block_sel = Selector::parse("h1, h2, h3, h4, p, li, pre, blockquote").ok();

    let mut lines = Vec::new();
    if let Some(sel) = block_sel {
        for elem in root_elem.select(&sel) {
            let tag_name = elem.value().name();
            let text = elem.text().collect::<String>().trim().to_string();
            if text.is_empty() {
                continue;
            }

            match tag_name {
                "h1" => lines.push(format!("\n# {}\n", text)),
                "h2" => lines.push(format!("\n## {}\n", text)),
                "h3" => lines.push(format!("\n### {}\n", text)),
                "h4" => lines.push(format!("\n#### {}\n", text)),
                "li" => lines.push(format!("- {}", text)),
                "pre" => lines.push(format!("\n```\n{}\n```\n", text)),
                "blockquote" => lines.push(format!("> {}", text)),
                _ => lines.push(text),
            }
        }
    }

    let mut full_content = lines.join("\n\n");
    if full_content.trim().is_empty() {
        // Fallback: collect all text from document
        full_content = document.root_element().text().collect::<Vec<_>>().join(" ");
    }

    // Clean whitespace
    let cleaned = full_content
        .split('\n')
        .map(|line| line.trim())
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n\n");

    const MAX_CHARS: usize = 6000;
    let (content, truncated) = if cleaned.len() > MAX_CHARS {
        (format!("{}\n\n...(content truncated to fit context)", &cleaned[..MAX_CHARS]), true)
    } else {
        (cleaned, false)
    };

    let character_count = content.len();

    Ok(WebPageResult {
        url: trimmed_url.to_string(),
        title,
        content,
        character_count,
        truncated,
    })
}

#[tauri::command]
pub async fn search_web(query: String, limit: Option<usize>) -> Result<WebSearchResult, String> {
    let lim = limit.unwrap_or(5);
    search_yahoo_async(&query, lim).await
}

#[tauri::command]
pub async fn fetch_web_page(url: String) -> Result<WebPageResult, String> {
    fetch_web_page_async(&url).await
}
