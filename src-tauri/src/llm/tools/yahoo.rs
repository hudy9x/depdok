use serde_json::json;

/// Scrape Yahoo Search endpoint for search results.
pub fn search_yahoo(query: &str) -> Result<String, String> {
    use scraper::{Html, Selector};

    let url = format!(
        "https://search.yahoo.com/search?p={}",
        urlencoding::encode(query)
    );

    let client = reqwest::blocking::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let html = client
        .get(&url)
        .send()
        .map_err(|e| format!("Web search request failed: {}", e))?
        .text()
        .map_err(|e| format!("Failed to read response: {}", e))?;

    let document = Html::parse_document(&html);
    let algo_sel = Selector::parse(".algo").unwrap();
    let title_sel = Selector::parse(".title").unwrap();
    let snippet_sel = Selector::parse(".compText").unwrap();
    let link_sel = Selector::parse(".compTitle a").unwrap();

    let mut results = Vec::new();
    for (i, result) in document.select(&algo_sel).enumerate() {
        if i >= 5 {
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
            results.push(json!({
                "title": title,
                "snippet": snippet,
                "url": decoded_url,
            }));
        }
    }

    Ok(json!({ "results": results }).to_string())
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
