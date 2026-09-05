use pulldown_cmark::{Event, Parser, Tag, HeadingLevel, TagEnd};

#[derive(Debug, Clone)]
pub struct ParsedSection {
    pub id: String,
    pub title: String,
    pub content: String,
    #[allow(dead_code)]
    pub level: u32,
    /// 0-based line number where this section's heading starts in the original file.
    pub line_start: u64,
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

/// Count the number of newlines before byte `offset` in `text`.
/// Returns the 0-based line number of that position.
fn line_at_byte(text: &str, offset: usize) -> u64 {
    text[..offset.min(text.len())].chars().filter(|&c| c == '\n').count() as u64
}

/// Strips YAML frontmatter if present and extracts any title property.
/// Returns (clean_markdown, optional_frontmatter_title, byte_offset_of_body)
pub fn strip_frontmatter(content: &str) -> (&str, Option<String>, usize) {
    let trimmed_start = content.trim_start();
    if !trimmed_start.starts_with("---") {
        return (content, None, 0);
    }

    let leading_whitespace_len = content.len() - trimmed_start.len();
    if let Some(rest) = trimmed_start.strip_prefix("---") {
        if let Some(first_newline) = rest.find('\n') {
            let after_first_line = &rest[first_newline + 1..];
            if let Some(closing_idx) = after_first_line.find("\n---") {
                let yaml_block = &after_first_line[..closing_idx];
                let after_closing = &after_first_line[closing_idx + 4..];
                let body_start_in_trimmed = (rest.as_ptr() as usize - trimmed_start.as_ptr() as usize)
                    + first_newline
                    + 1
                    + closing_idx
                    + 4;
                let body_offset = leading_whitespace_len + body_start_in_trimmed;

                let actual_body_offset = if let Some(_stripped) = after_closing.strip_prefix("\r\n") {
                    body_offset + 2
                } else if let Some(_stripped) = after_closing.strip_prefix('\n') {
                    body_offset + 1
                } else {
                    body_offset
                };

                // Extract title: from yaml if present
                let mut title = None;
                for line in yaml_block.lines() {
                    let trimmed = line.trim();
                    if let Some(val) = trimmed.strip_prefix("title:") {
                        let t = val.trim().trim_matches('"').trim_matches('\'').trim();
                        if !t.is_empty() {
                            title = Some(t.to_string());
                            break;
                        }
                    }
                }

                let clean_body = if actual_body_offset < content.len() {
                    content[actual_body_offset..].trim_start_matches(|c| c == '\r' || c == '\n')
                } else {
                    ""
                };
                return (clean_body, title, actual_body_offset);
            }
        }
    }

    (content, None, 0)
}

/// Split markdown text into hierarchical section documents at heading boundaries.
pub fn split_markdown_into_sections(content: &str) -> Vec<ParsedSection> {
    let (clean_content, frontmatter_title, body_offset) = strip_frontmatter(content);
    let parser = Parser::new(clean_content);
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
                    let section_content = clean_content[prev_start..heading_start].trim().to_string();
                    if !section_content.is_empty() {
                        sections.push(ParsedSection {
                            id: slugify_section_title(&prev_title),
                            title: prev_title,
                            content: section_content,
                            level: prev_level,
                            line_start: line_at_byte(content, body_offset + prev_start),
                        });
                    }
                }
                current_heading = Some((heading_text.trim().to_string(), heading_level, heading_start));
            }
            _ => {}
        }
    }

    if let Some((prev_title, prev_level, prev_start)) = current_heading {
        let section_content = clean_content[prev_start..].trim().to_string();
        if !section_content.is_empty() {
            sections.push(ParsedSection {
                id: slugify_section_title(&prev_title),
                title: prev_title,
                content: section_content,
                level: prev_level,
                line_start: line_at_byte(content, body_offset + prev_start),
            });
        }
    } else if !clean_content.trim().is_empty() {
        let fallback_title = frontmatter_title.unwrap_or_else(|| "Overview".to_string());
        sections.push(ParsedSection {
            id: slugify_section_title(&fallback_title),
            title: fallback_title,
            content: clean_content.trim().to_string(),
            level: 1,
            line_start: line_at_byte(content, body_offset),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_frontmatter() {
        let md = "---\ntitle: Project Roadmap\nauthor: Maya\n---\n\n# Heading 1\nContent here";
        let (body, title, offset) = strip_frontmatter(md);
        assert_eq!(title, Some("Project Roadmap".to_string()));
        assert_eq!(body, "# Heading 1\nContent here");
        assert!(offset > 0);
    }

    #[test]
    fn test_split_sections_with_frontmatter() {
        let md = "---\ntitle: Project Nexus Q3 Roadmap\nauthor: Maya\n---\n\n# Section 1\nSome description\n\n## Section 2\nMore details";
        let sections = split_markdown_into_sections(md);
        assert_eq!(sections.len(), 2);
        assert_eq!(sections[0].title, "Section 1");
        assert_eq!(sections[1].title, "Section 2");
    }

    #[test]
    fn test_split_sections_no_heading_with_frontmatter() {
        let md = "---\ntitle: Document Without Headings\n---\n\nJust pure paragraph text.";
        let sections = split_markdown_into_sections(md);
        assert_eq!(sections.len(), 1);
        assert_eq!(sections[0].title, "Document Without Headings");
        assert_eq!(sections[0].content, "Just pure paragraph text.");
    }
}

