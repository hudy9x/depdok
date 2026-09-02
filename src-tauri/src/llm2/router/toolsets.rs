use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Toolset {
  None,
  File,
  Folder,
  Knowledge,
  WebSearch,
  Execution,
  Spreadsheet,
  All,
}

pub const ALL_KNOWN_TOOLS: &[&str] = &[
  "search_knowledge_base",
  "web_search",
  "fetch_web_page",
  "generate_content",
  "create_file",
  "create_folder",
  "rename_file",
  "rename_folder",
  "delete_file_or_folder",
  "move_files_or_folders",
  "list_files",
  "search_file",
  "read_markdown",
  "upsert_markdown",
  "upsert_markdown_section",
  "add_markdown_comment",
  "write_skill",
  "get_current_datetime",
  "run_shell",
  "mcp_verify_config",
  "mcp_test_server",
  "mcp_list_servers",
  "mcp_reload",
  "reload_skills",
  "sheet_read",
  "sheet_get_data",
  "sheet_get_cell",
  "sheet_create",
  "sheet_set_range_data",
  "sheet_edit_cell",
  "sheet_clear_range",
  "sheet_manage_sheet",
  "sheet_modify_structure",
  "sheet_format_range",
  "sheet_execute_commands",
];

impl Toolset {
  pub fn from_single_token(token: &str) -> Option<Self> {
    let clean = token.trim().to_uppercase();
    if clean.contains("NONE") {
      Some(Toolset::None)
    } else if clean.contains("FOLDER") || clean.contains("DIR") {
      Some(Toolset::Folder)
    } else if clean.contains("FILE") {
      Some(Toolset::File)
    } else if clean.contains("WEB") || clean.contains("INTERNET") {
      Some(Toolset::WebSearch)
    } else if clean.contains("KNOWLEDGE") {
      Some(Toolset::Knowledge)
    } else if clean.contains("SHELL") || clean.contains("TERMINAL") {
      Some(Toolset::Execution)
    } else if clean.contains("SPREADSHEET") || clean.contains("SHEET") {
      Some(Toolset::Spreadsheet)
    } else if clean.contains("ALL") {
      Some(Toolset::All)
    } else {
      None
    }
  }

  /// Parses multiple categories from raw model output (e.g. "FILE, FOLDER", "WEB, FILE").
  pub fn from_multi_label(raw: &str) -> Vec<Self> {
    let mut toolsets = Vec::new();
    let parts: Vec<&str> = raw
      .split(|c: char| c == ',' || c == '+' || c == ';' || c == '\n')
      .collect();

    for part in parts {
      if let Some(ts) = Self::from_single_token(part) {
        if !toolsets.contains(&ts) {
          toolsets.push(ts);
        }
      }
    }

    // If "NONE" was returned along with active toolsets, discard "NONE"
    if toolsets.len() > 1 {
      toolsets.retain(|ts| *ts != Toolset::None);
    }

    if toolsets.is_empty() {
      let upper = raw.to_uppercase();
      let mut found = Vec::new();
      if upper.contains("FOLDER") || upper.contains("DIR") {
        found.push(Toolset::Folder);
      }
      if upper.contains("FILE") {
        found.push(Toolset::File);
      }
      if upper.contains("WEB") || upper.contains("INTERNET") {
        found.push(Toolset::WebSearch);
      }
      if upper.contains("KNOWLEDGE") {
        found.push(Toolset::Knowledge);
      }
      if upper.contains("SHELL") || upper.contains("TERMINAL") {
        found.push(Toolset::Execution);
      }
      if upper.contains("SPREADSHEET") || upper.contains("SHEET") {
        found.push(Toolset::Spreadsheet);
      }
      if upper.contains("NONE") && found.is_empty() {
        found.push(Toolset::None);
      }

      if found.is_empty() {
        vec![Toolset::All]
      } else {
        found
      }
    } else {
      toolsets
    }
  }

  pub fn as_str(&self) -> &'static str {
    match self {
      Toolset::None => "NONE",
      Toolset::File => "FILE",
      Toolset::Folder => "FOLDER",
      Toolset::Knowledge => "KNOWLEDGE",
      Toolset::WebSearch => "WEB",
      Toolset::Execution => "SHELL",
      Toolset::Spreadsheet => "SPREADSHEET",
      Toolset::All => "ALL",
    }
  }

  pub fn tools(&self) -> Vec<&'static str> {
    match self {
      Toolset::None => vec![],
      // File-specific: creating, reading, editing files and markdown content
      Toolset::File => vec![
        "create_file",
        "rename_file",
        "delete_file_or_folder",
        "search_file",
        "read_markdown",
        "upsert_markdown",
        "upsert_markdown_section",
        "add_markdown_comment",
      ],
      // Folder-specific: directory tree, folder creation, navigation, moving files
      Toolset::Folder => vec![
        "create_folder",
        "rename_folder",
        "list_files",
        "move_files_or_folders",
        "delete_file_or_folder",
      ],
      // Knowledge base search
      Toolset::Knowledge => vec!["search_knowledge_base"],
      // Web search & online page retrieval
      Toolset::WebSearch => vec!["web_search", "fetch_web_page"],
      // Shell execution
      Toolset::Execution => vec!["run_shell"],
      // Spreadsheet suite
      Toolset::Spreadsheet => vec![
        "sheet_read",
        "sheet_get_data",
        "sheet_get_cell",
        "sheet_create",
        "sheet_set_range_data",
        "sheet_edit_cell",
        "sheet_clear_range",
        "sheet_manage_sheet",
        "sheet_modify_structure",
        "sheet_format_range",
        "sheet_execute_commands",
      ],
      // Fallback
      Toolset::All => ALL_KNOWN_TOOLS.to_vec(),
    }
  }
}
