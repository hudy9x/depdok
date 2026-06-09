#[derive(Debug, Clone)]
pub struct MarkdownSection {
    pub id: String,
    pub title: String,
    pub content: String,
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

fn parse_markdown_heading(line: &str) -> Option<String> {
    let trimmed = line.trim();
    let mut chars = trimmed.chars().peekable();

    let mut heading_marks = 0usize;
    while let Some('#') = chars.peek() {
        chars.next();
        heading_marks += 1;
        if heading_marks > 6 {
            return None;
        }
    }

    if heading_marks == 0 {
        return None;
    }

    if !matches!(chars.peek(), Some(' ') | Some('\t')) {
        return None;
    }

    let heading_text = chars.collect::<String>().trim().trim_end_matches('#').trim().to_string();
    if heading_text.is_empty() {
        return None;
    }

    Some(heading_text)
}

pub fn split_markdown_into_sections(content: &str) -> Vec<MarkdownSection> {
    let mut sections: Vec<MarkdownSection> = Vec::new();
    let mut current_title: Option<String> = None;
    let mut current_lines: Vec<String> = Vec::new();

    let push_current_section = |sections: &mut Vec<MarkdownSection>,
                                current_title: &Option<String>,
                                current_lines: &Vec<String>| {
        if current_lines.is_empty() {
            return;
        }

        let content = current_lines.join("\n").trim().to_string();
        if content.is_empty() {
            return;
        }

        let title = current_title
            .clone()
            .unwrap_or_else(|| "Overview".to_string());

        sections.push(MarkdownSection {
            id: slugify_section_title(&title),
            title,
            content,
        });
    };

    for line in content.lines() {
        if let Some(next_title) = parse_markdown_heading(line) {
            push_current_section(&mut sections, &current_title, &current_lines);
            current_title = Some(next_title);
            current_lines = vec![line.to_string()];
            continue;
        }

        current_lines.push(line.to_string());
    }

    push_current_section(&mut sections, &current_title, &current_lines);

    sections
}