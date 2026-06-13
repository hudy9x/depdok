use pulldown_cmark::{Event, Parser, Tag, HeadingLevel, TagEnd};

#[derive(Debug, Clone)]
pub struct ParsedSection {
    pub id: String,
    pub title: String,
    pub content: String,
    #[allow(dead_code)]
    pub level: u32,
}

#[derive(Debug, Clone, Default)]
pub struct ExtractedMetadata {
    pub tags: Vec<String>,
    pub links: Vec<String>,
}

fn slugify_section_title(title: &str) -> String {
    let mut slug = String::new();
    let mut previous_was_dash = false;

    for ch in title.chars().flat_map(|c| c.to_lowercase()) {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch);
            previous_was_dash = false;
        } else if (ch.is_ascii_whitespace() || ch == '-') && !previous_was_dash && !slug.is_empty() {
            slug.push('-');
            previous_was_dash = true;
        }
    }

    while slug.ends_with('-') {
        slug.pop();
    }

    if slug.is_empty() {
        "section".to_string()
    } else {
        slug
    }
}

/// Split markdown text into hierarchical section documents at heading boundaries.
pub fn split_markdown_into_sections(content: &str) -> Vec<ParsedSection> {
    let parser = Parser::new(content);
    let mut sections = Vec::new();
    let mut current_heading: Option<(String, u32, usize)> = None; // (title, level, start_byte_offset)
    
    let mut in_heading = false;
    let mut heading_text = String::new();
    let mut heading_level = 1u32;
    let mut heading_start = 0usize;

    for (event, range) in parser.into_offset_iter() {
        match event {
            Event::Start(Tag::Heading { level, .. }) => {
                in_heading = true;
                heading_text.clear();
                heading_level = match level {
                    HeadingLevel::H1 => 1,
                    HeadingLevel::H2 => 2,
                    HeadingLevel::H3 => 3,
                    HeadingLevel::H4 => 4,
                    HeadingLevel::H5 => 5,
                    HeadingLevel::H6 => 6,
                };
                heading_start = range.start;
            }
            Event::Text(text) if in_heading => {
                heading_text.push_str(&text);
            }
            Event::End(TagEnd::Heading(..)) => {
                in_heading = false;
                
                if let Some((prev_title, prev_level, prev_start)) = current_heading {
                    let section_content = content[prev_start..heading_start].trim().to_string();
                    if !section_content.is_empty() {
                        sections.push(ParsedSection {
                            id: slugify_section_title(&prev_title),
                            title: prev_title,
                            content: section_content,
                            level: prev_level,
                        });
                    }
                }
                current_heading = Some((heading_text.trim().to_string(), heading_level, heading_start));
            }
            _ => {}
        }
    }

    if let Some((prev_title, prev_level, prev_start)) = current_heading {
        let section_content = content[prev_start..].trim().to_string();
        if !section_content.is_empty() {
            sections.push(ParsedSection {
                id: slugify_section_title(&prev_title),
                title: prev_title,
                content: section_content,
                level: prev_level,
            });
        }
    } else if !content.trim().is_empty() {
        sections.push(ParsedSection {
            id: "overview".to_string(),
            title: "Overview".to_string(),
            content: content.trim().to_string(),
            level: 1,
        });
    }

    // Deduplicate section IDs in the list
    let mut id_counts = std::collections::HashMap::new();
    for section in &mut sections {
        let count = id_counts.entry(section.id.clone()).or_insert(0);
        *count += 1;
        if *count > 1 {
            section.id = format!("{}-{}", section.id, count);
        }
    }

    sections
}

/// Extract tags and links (both markdown links and wikilinks) from markdown content.
pub fn extract_metadata(content: &str) -> ExtractedMetadata {
    let parser = Parser::new(content);
    let mut tags = std::collections::HashSet::new();
    let mut links = std::collections::HashSet::new();
    let mut in_code_block = false;

    for (event, _) in parser.into_offset_iter() {
        match event {
            Event::Start(Tag::Link { dest_url, .. }) => {
                let url_str = dest_url.to_string();
                if !url_str.contains("://") && !url_str.starts_with("mailto:") && !url_str.starts_with("#") {
                    links.insert(url_str);
                }
            }
            Event::Start(Tag::CodeBlock(_)) => {
                in_code_block = true;
            }
            Event::End(TagEnd::CodeBlock) => {
                in_code_block = false;
            }
            Event::Text(text) if !in_code_block => {
                let chars: Vec<char> = text.chars().collect();
                let mut i = 0;
                while i < chars.len() {
                    // Hashtags scan
                    if chars[i] == '#' {
                        let is_start = i == 0 || chars[i - 1].is_whitespace() || matches!(chars[i - 1], '(' | '[' | '{' | ',');
                        if is_start && i + 1 < chars.len() && chars[i + 1].is_alphabetic() {
                            let mut tag = String::new();
                            let mut j = i + 1;
                            while j < chars.len() && (chars[j].is_alphanumeric() || chars[j] == '-' || chars[j] == '_') {
                                tag.push(chars[j]);
                                j += 1;
                            }
                            if !tag.is_empty() {
                                tags.insert(tag);
                            }
                            i = j;
                            continue;
                        }
                    }
                    
                    // Wikilinks scan: [[target]] or [[target|label]]
                    if chars[i] == '[' && i + 1 < chars.len() && chars[i + 1] == '[' {
                        let mut j = i + 2;
                        let mut target = String::new();
                        let mut found_end = false;
                        while j < chars.len() {
                            if chars[j] == ']' && j + 1 < chars.len() && chars[j + 1] == ']' {
                                found_end = true;
                                break;
                            }
                            if chars[j] == '|' {
                                let mut k = j + 1;
                                while k < chars.len() {
                                    if chars[k] == ']' && k + 1 < chars.len() && chars[k + 1] == ']' {
                                        found_end = true;
                                        break;
                                    }
                                    k += 1;
                                }
                                break;
                            }
                            target.push(chars[j]);
                            j += 1;
                        }
                        if found_end {
                            let target = target.trim().to_string();
                            if !target.is_empty() {
                                links.insert(target);
                            }
                        }
                    }
                    
                    i += 1;
                }
            }
            _ => {}
        }
    }

    ExtractedMetadata {
        tags: tags.into_iter().collect(),
        links: links.into_iter().collect(),
    }
}
