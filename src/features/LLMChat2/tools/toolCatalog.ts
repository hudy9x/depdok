/**
 * List of all valid built-in tool items with descriptions for slash autocomplete.
 */
export interface ToolCatalogItem {
  name: string;
  description: string;
  category: "file" | "folder" | "knowledge" | "web" | "shell" | "spreadsheet" | "system";
}

export const TOOL_CATALOG: ToolCatalogItem[] = [
  // File operations
  {
    name: "create_file",
    description: "Create a new file in workspace with optional initial content",
    category: "file",
  },
  {
    name: "read_markdown",
    description: "Read markdown file content",
    category: "file",
  },
  {
    name: "upsert_markdown",
    description: "Write or update entire markdown document",
    category: "file",
  },
  {
    name: "upsert_markdown_section",
    description: "Update or append a specific section heading in markdown",
    category: "file",
  },
  {
    name: "rename_file",
    description: "Rename or move a file",
    category: "file",
  },
  {
    name: "delete_file_or_folder",
    description: "Delete a file or folder from workspace",
    category: "file",
  },
  {
    name: "search_file",
    description: "Fuzzy search files and filenames in workspace",
    category: "file",
  },
  {
    name: "add_markdown_comment",
    description: "Add an inline critique or review comment to markdown text",
    category: "file",
  },

  // Folder operations
  {
    name: "create_folder",
    description: "Create directory / folder path in workspace",
    category: "folder",
  },
  {
    name: "rename_folder",
    description: "Rename a directory",
    category: "folder",
  },
  {
    name: "list_files",
    description: "List directory files and folders recursively",
    category: "folder",
  },
  {
    name: "move_files_or_folders",
    description: "Move files or folders to a target directory",
    category: "folder",
  },

  // Knowledge & Web
  {
    name: "search_knowledge_base",
    description: "Semantic vector & keyword search across workspace notes",
    category: "knowledge",
  },
  {
    name: "web_search",
    description: "Search the web using search engine",
    category: "web",
  },
  {
    name: "fetch_web_page",
    description: "Fetch and read text content from a web URL",
    category: "web",
  },

  // Shell & System
  {
    name: "run_shell",
    description: "Execute bash/cmd terminal commands with output capture",
    category: "shell",
  },
  {
    name: "get_current_datetime",
    description: "Get current system date, time, and timezone",
    category: "system",
  },
  {
    name: "generate_content",
    description: "Delegate long prose writing to content specialist model",
    category: "system",
  },

  // Skills & MCP
  {
    name: "write_skill",
    description: "Create or edit an agent skill in .depdok/skills/",
    category: "system",
  },
  {
    name: "reload_skills",
    description: "Reload all skills from disk cache",
    category: "system",
  },
  {
    name: "mcp_reload",
    description: "Reload MCP configuration and reconnect servers",
    category: "system",
  },

  // Spreadsheet suite
  {
    name: "sheet_read",
    description: "Read spreadsheet summary, sheets, and active dimensions",
    category: "spreadsheet",
  },
  {
    name: "sheet_get_data",
    description: "Get 2D array of raw values or formulas from sheet",
    category: "spreadsheet",
  },
  {
    name: "sheet_get_cell",
    description: "Get detailed cell metadata (value, formula, format)",
    category: "spreadsheet",
  },
  {
    name: "sheet_create",
    description: "Create a new Excel (.xlsx) or CSV spreadsheet file",
    category: "spreadsheet",
  },
  {
    name: "sheet_set_range_data",
    description: "Set values or formulas into a cell range",
    category: "spreadsheet",
  },
  {
    name: "sheet_edit_cell",
    description: "Edit single cell value or formula",
    category: "spreadsheet",
  },
  {
    name: "sheet_clear_range",
    description: "Clear contents or formatting in range",
    category: "spreadsheet",
  },
  {
    name: "sheet_manage_sheet",
    description: "Add, delete, rename, or reorder sheet tabs",
    category: "spreadsheet",
  },
  {
    name: "sheet_modify_structure",
    description: "Insert or delete rows and columns in spreadsheet",
    category: "spreadsheet",
  },
  {
    name: "sheet_format_range",
    description: "Format range styles (bold, color, num_fmt, borders)",
    category: "spreadsheet",
  },
  {
    name: "sheet_execute_commands",
    description: "Execute batch spreadsheet atomic commands",
    category: "spreadsheet",
  },
];

export const AVAILABLE_TOOL_NAMES = TOOL_CATALOG.map((t) => t.name);
export type AvailableToolName = (typeof AVAILABLE_TOOL_NAMES)[number];
