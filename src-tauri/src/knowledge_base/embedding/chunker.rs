/// Options that control how text is split into chunks before embedding.
pub struct ChunkOptions {
    /// Maximum number of characters per chunk.
    pub max_chars: usize,
    /// Number of characters that overlap between consecutive chunks so context
    /// is not lost at boundaries.
    pub overlap_chars: usize,
}

impl Default for ChunkOptions {
    fn default() -> Self {
        Self {
            max_chars: 512,
            overlap_chars: 64,
        }
    }
}

/// Split `text` into overlapping chunks using `opts`.
///
/// - If the text fits within `max_chars` it is returned as a single chunk.
/// - Splits prefer natural boundaries (paragraph → sentence → word) near the
///   `max_chars` limit; falls back to a hard character split.
/// - Chunk IDs are not assigned here — callers use `"{doc_id}#{index}"`.
pub fn chunk_text(text: &str, opts: &ChunkOptions) -> Vec<String> {
    if text.len() <= opts.max_chars {
        let trimmed = text.trim().to_string();
        return if trimmed.is_empty() { vec![] } else { vec![trimmed] };
    }

    let mut chunks: Vec<String> = Vec::new();
    let bytes = text.as_bytes();
    let len = bytes.len();
    let mut start = 0usize;

    while start < len {
        let raw_end = (start + opts.max_chars).min(len);

        // Ensure we land on a valid UTF-8 character boundary.
        let end = ceil_char_boundary(text, raw_end);

        // Try to find a natural split point searching backwards from `end`.
        let split = if end < len {
            find_split_point(text, start, end)
        } else {
            end
        };

        let chunk = text[start..split].trim().to_string();
        if !chunk.is_empty() {
            chunks.push(chunk);
        }

        // Advance, backing up by `overlap_chars` for context continuity.
        // The computed byte index may fall inside a multibyte UTF-8 codepoint,
        // so we round down to a valid character boundary.
        let overlap_start = split.saturating_sub(opts.overlap_chars);
        let next_start = floor_char_boundary(text, overlap_start);

        if next_start <= start {
            // Safety: avoid infinite loop on degenerate input.
            break;
        }
        start = next_start;
    }

    chunks
}

/// Walk backwards from `end` inside `text[start..end]` looking for a
/// natural split point: paragraph break > sentence end > semicolon > space.
fn find_split_point(text: &str, start: usize, end: usize) -> usize {
    let window = &text[start..end];

    // Prefer paragraph boundary.
    if let Some(pos) = window.rfind("\n\n") {
        return start + pos + 2;
    }

    // Sentence-ending punctuation.
    for delim in ['\n', '.', '!', '?', ';'] {
        if let Some(pos) = window.rfind(delim) {
            return start + pos + 1;
        }
    }

    // Word boundary.
    if let Some(pos) = window.rfind(' ') {
        return start + pos + 1;
    }

    // Hard split — guaranteed valid UTF-8 boundary.
    end
}

/// Round `index` up to the nearest UTF-8 character boundary in `s`.
fn ceil_char_boundary(s: &str, index: usize) -> usize {
    if index >= s.len() {
        return s.len();
    }
    let mut i = index;
    while i < s.len() && !s.is_char_boundary(i) {
        i += 1;
    }
    i
}

/// Round `index` down to the nearest UTF-8 character boundary in `s`.
fn floor_char_boundary(s: &str, index: usize) -> usize {
    if index >= s.len() {
        return s.len();
    }
    let mut i = index;
    while i > 0 && !s.is_char_boundary(i) {
        i -= 1;
    }
    i
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn single_chunk_when_short() {
        let chunks = chunk_text("Hello world", &ChunkOptions::default());
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0], "Hello world");
    }

    #[test]
    fn splits_long_text() {
        let long = "word ".repeat(200); // ~1000 chars
        let chunks = chunk_text(&long, &ChunkOptions { max_chars: 100, overlap_chars: 20 });
        assert!(chunks.len() > 1);
        for chunk in &chunks {
            assert!(chunk.len() <= 105); // slight slack for boundary rounding
        }
    }

    #[test]
    fn does_not_panic_on_multibyte_overlap() {
        let text = "## Mermaid Diagram Support\n\nNhiều ứng dụng hỗ trợ sơ đồ với ký tự tiếng Việt như: sự, ự, ắ, ề.\n\n".repeat(10);
        let chunks = chunk_text(
            &text,
            &ChunkOptions {
                max_chars: 128,
                overlap_chars: 37,
            },
        );

        assert!(!chunks.is_empty());
        assert!(chunks.iter().all(|chunk| !chunk.is_empty()));
    }
}
