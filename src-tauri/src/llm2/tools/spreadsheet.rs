use rig::tool::PortableTool;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::AppHandle;

use super::bridge::{call_frontend_tool, ToolBridgeError};
use crate::llm2::runtime::PendingRequests;

// 1. SheetReadTool
#[derive(Clone)]
pub struct SheetReadTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SheetReadArgs {
  #[serde(default)]
  pub path: Option<String>,
}

impl PortableTool for SheetReadTool {
  const NAME: &'static str = "sheet_read";
  type Error = ToolBridgeError;
  type Args = SheetReadArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Inspect the metadata and overview of an Excel/CSV spreadsheet workbook. Returns sheet names, active tab, row and column counts, cell count, and a 5x5 preview matrix for each sheet.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "The spreadsheet file path (e.g. 'budget.xlsx' or 'data.csv'). Omit or pass 'active' to inspect the currently open spreadsheet document."
        }
      }
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}

// 2. SheetGetDataTool
#[derive(Clone)]
pub struct SheetGetDataTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SheetGetDataArgs {
  #[serde(default)]
  pub path: Option<String>,
  #[serde(default)]
  pub sheet: Option<String>,
  #[serde(default)]
  pub range: Option<String>,
  #[serde(default)]
  pub format: Option<String>,
}

impl PortableTool for SheetGetDataTool {
  const NAME: &'static str = "sheet_get_data";
  type Error = ToolBridgeError;
  type Args = SheetGetDataArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Retrieve tabular data or a range from a spreadsheet. Can return data as a 2D matrix ('grid') or as an array of row JSON objects with column headers ('table').".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "The spreadsheet file path (or omit/'active' for open document)."
        },
        "sheet": {
          "type": "string",
          "description": "Target sheet name (defaults to active sheet)."
        },
        "range": {
          "type": "string",
          "description": "Optional cell range bound (e.g. 'A1:E20'). Defaults to whole data range."
        },
        "format": {
          "type": "string",
          "enum": ["grid", "table"],
          "description": "Output format: 'grid' returns a 2D array [[val, ...], ...]; 'table' returns an array of row objects using the first row as column keys."
        }
      }
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}

// 3. SheetGetCellTool
#[derive(Clone)]
pub struct SheetGetCellTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SheetGetCellArgs {
  #[serde(default)]
  pub path: Option<String>,
  #[serde(default)]
  pub sheet: Option<String>,
  pub cell: String,
}

impl PortableTool for SheetGetCellTool {
  const NAME: &'static str = "sheet_get_cell";
  type Error = ToolBridgeError;
  type Args = SheetGetCellArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Inspect a specific spreadsheet cell. Returns raw value, calculated formula value, formula expression ('=SUM(...)'), formatted text, number format pattern, and styles.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "The spreadsheet file path (or omit/'active' for open document)."
        },
        "sheet": {
          "type": "string",
          "description": "Target sheet name (defaults to active sheet)."
        },
        "cell": {
          "type": "string",
          "description": "Cell coordinate address (e.g. 'A1', 'C12', 'F4')."
        }
      },
      "required": ["cell"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}

// 4. SheetCreateTool
#[derive(Clone)]
pub struct SheetCreateTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SheetCreateArgs {
  pub path: String,
  #[serde(default)]
  pub sheet_name: Option<String>,
  #[serde(default)]
  pub initial_data: Option<Vec<Vec<serde_json::Value>>>,
}

impl PortableTool for SheetCreateTool {
  const NAME: &'static str = "sheet_create";
  type Error = ToolBridgeError;
  type Args = SheetCreateArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Create a new .xlsx spreadsheet workbook on disk with an initial sheet and optional 2D table data.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "The file path for the new spreadsheet (e.g. 'financial_report.xlsx')."
        },
        "sheet_name": {
          "type": "string",
          "description": "Initial sheet name (defaults to 'Sheet1')."
        },
        "initial_data": {
          "type": "array",
          "description": "Optional 2D array of initial rows and columns (e.g. [['Name', 'Amount'], ['Alice', 100]]).",
          "items": {
            "type": "array",
            "items": {}
          }
        }
      },
      "required": ["path"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}

// 5. SheetSetRangeDataTool
#[derive(Clone)]
pub struct SheetSetRangeDataTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SheetSetRangeDataArgs {
  #[serde(default)]
  pub path: Option<String>,
  #[serde(default)]
  pub sheet: Option<String>,
  pub start_cell: String,
  pub data: Vec<Vec<serde_json::Value>>,
}

impl PortableTool for SheetSetRangeDataTool {
  const NAME: &'static str = "sheet_set_range_data";
  type Error = ToolBridgeError;
  type Args = SheetSetRangeDataArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Bulk write a 2D matrix of values and formulas into a spreadsheet starting at a specific cell (e.g. start_cell 'A1'). Strings starting with '=' are evaluated as Excel formulas.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "The spreadsheet file path (or omit/'active' for open document)."
        },
        "sheet": {
          "type": "string",
          "description": "Target sheet name (defaults to active sheet)."
        },
        "start_cell": {
          "type": "string",
          "description": "Top-left cell coordinate to start writing data (e.g. 'A1', 'B5')."
        },
        "data": {
          "type": "array",
          "description": "2D array of rows and values/formulas (e.g. [['Item', 'Price', 'Total'], ['Widget', 25, '=B2*2']]).",
          "items": {
            "type": "array",
            "items": {}
          }
        }
      },
      "required": ["start_cell", "data"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}

// 6. SheetEditCellTool
#[derive(Clone)]
pub struct SheetEditCellTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SheetEditCellArgs {
  #[serde(default)]
  pub path: Option<String>,
  #[serde(default)]
  pub sheet: Option<String>,
  pub cell: String,
  pub value: serde_json::Value,
}

impl PortableTool for SheetEditCellTool {
  const NAME: &'static str = "sheet_edit_cell";
  type Error = ToolBridgeError;
  type Args = SheetEditCellArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Set or update an individual cell's value or formula in a spreadsheet. Strings starting with '=' (e.g. '=SUM(A1:A10)') are treated as formulas.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "The spreadsheet file path (or omit/'active' for open document)."
        },
        "sheet": {
          "type": "string",
          "description": "Target sheet name (defaults to active sheet)."
        },
        "cell": {
          "type": "string",
          "description": "Cell coordinate address (e.g. 'B2', 'D10')."
        },
        "value": {
          "description": "The new value (string, number, boolean, or formula '=SUM(...)')."
        }
      },
      "required": ["cell", "value"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}

// 7. SheetClearRangeTool
#[derive(Clone)]
pub struct SheetClearRangeTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SheetClearRangeArgs {
  #[serde(default)]
  pub path: Option<String>,
  #[serde(default)]
  pub sheet: Option<String>,
  pub range: String,
  #[serde(default)]
  pub clear_styles: Option<bool>,
}

impl PortableTool for SheetClearRangeTool {
  const NAME: &'static str = "sheet_clear_range";
  type Error = ToolBridgeError;
  type Args = SheetClearRangeArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Clear cell values, formulas, or formatting styles in a given spreadsheet range (e.g. 'A1:C10').".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "The spreadsheet file path (or omit/'active' for open document)."
        },
        "sheet": {
          "type": "string",
          "description": "Target sheet name (defaults to active sheet)."
        },
        "range": {
          "type": "string",
          "description": "Range address to clear (e.g. 'A2:D20')."
        },
        "clear_styles": {
          "type": "boolean",
          "description": "If true, also removes custom formatting, borders, and styles."
        }
      },
      "required": ["range"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}

// 8. SheetManageSheetTool
#[derive(Clone)]
pub struct SheetManageSheetTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SheetManageSheetArgs {
  #[serde(default)]
  pub path: Option<String>,
  pub action: String,
  #[serde(default)]
  pub sheet_name: Option<String>,
  #[serde(default)]
  pub new_name: Option<String>,
}

impl PortableTool for SheetManageSheetTool {
  const NAME: &'static str = "sheet_manage_sheet";
  type Error = ToolBridgeError;
  type Args = SheetManageSheetArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Manage sheet tabs in a workbook (add, delete, rename, duplicate, or set active sheet).".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "The spreadsheet file path (or omit/'active' for open document)."
        },
        "action": {
          "type": "string",
          "enum": ["add", "delete", "rename", "duplicate", "set_active"],
          "description": "The action to perform on sheet tabs."
        },
        "sheet_name": {
          "type": "string",
          "description": "Target sheet name for delete, duplicate, set_active, or the old name for rename."
        },
        "new_name": {
          "type": "string",
          "description": "The new sheet name (for 'add' or 'rename')."
        }
      },
      "required": ["action"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}

// 9. SheetModifyStructureTool
#[derive(Clone)]
pub struct SheetModifyStructureTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SheetModifyStructureArgs {
  #[serde(default)]
  pub path: Option<String>,
  #[serde(default)]
  pub sheet: Option<String>,
  pub action: String,
  pub index: i64,
  #[serde(default)]
  pub size: Option<f64>,
}

impl PortableTool for SheetModifyStructureTool {
  const NAME: &'static str = "sheet_modify_structure";
  type Error = ToolBridgeError;
  type Args = SheetModifyStructureArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Modify spreadsheet grid structure: insert or delete rows/columns, or configure column widths and row heights in pixels.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "The spreadsheet file path (or omit/'active' for open document)."
        },
        "sheet": {
          "type": "string",
          "description": "Target sheet name (defaults to active sheet)."
        },
        "action": {
          "type": "string",
          "enum": ["insert_row", "delete_row", "insert_col", "delete_col", "set_col_width", "set_row_height"],
          "description": "Grid structural operation to execute."
        },
        "index": {
          "type": "integer",
          "description": "0-indexed row or column number."
        },
        "size": {
          "type": "number",
          "description": "Dimension in pixels (required for 'set_col_width' or 'set_row_height')."
        }
      },
      "required": ["action", "index"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}

// 10. SheetFormatRangeTool
#[derive(Clone)]
pub struct SheetFormatRangeTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SheetFormatRangeArgs {
  #[serde(default)]
  pub path: Option<String>,
  #[serde(default)]
  pub sheet: Option<String>,
  pub range: String,
  #[serde(default)]
  pub style: Option<serde_json::Value>,
  #[serde(default)]
  pub num_fmt: Option<String>,
  #[serde(default)]
  pub border: Option<serde_json::Value>,
}

impl PortableTool for SheetFormatRangeTool {
  const NAME: &'static str = "sheet_format_range";
  type Error = ToolBridgeError;
  type Args = SheetFormatRangeArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Apply visual formatting to a spreadsheet cell range: text styles (bold, italic, color, bgColor, align), number formats ('$#,##0.00', '0.0%'), or borders.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "The spreadsheet file path (or omit/'active' for open document)."
        },
        "sheet": {
          "type": "string",
          "description": "Target sheet name (defaults to active sheet)."
        },
        "range": {
          "type": "string",
          "description": "Cell range to format (e.g. 'A1:D1', 'B2:B10')."
        },
        "style": {
          "type": "object",
          "description": "Styling properties: { bold?: bool, italic?: bool, color?: string, bgColor?: string, bg_color?: string, align?: 'left'|'center'|'right', fontSize?: number, font_size?: number }."
        },
        "bg_color": {
          "type": "string",
          "description": "Optional shorthand background/fill hex color (e.g. '#FFFF00', '#E2E8F0', '#3B82F6')."
        },
        "num_fmt": {
          "type": "string",
          "description": "Number format string (e.g. '$#,##0.00', '0.0%', 'YYYY-MM-DD', '@')."
        },
        "border": {
          "type": "object",
          "description": "Border settings: { borderType: 'all'|'outer'|'inner'|'top'|'bottom'|'left'|'right'|'none', color?: string, style?: 'thin'|'medium'|'thick'|'double'|'dashed'|'dotted' }."
        }
      },
      "required": ["range"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}

// 11. SheetExecuteCommandsTool
#[derive(Clone)]
pub struct SheetExecuteCommandsTool {
  pub app: AppHandle,
  pub pending: PendingRequests,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SheetExecuteCommandsArgs {
  #[serde(default)]
  pub path: Option<String>,
  pub commands: Vec<serde_json::Value>,
}

impl PortableTool for SheetExecuteCommandsTool {
  const NAME: &'static str = "sheet_execute_commands";
  type Error = ToolBridgeError;
  type Args = SheetExecuteCommandsArgs;
  type Output = serde_json::Value;

  fn description(&self) -> String {
    "Execute an atomic batch of low-level SpreadsheetCommand objects against a workbook.".to_string()
  }

  fn parameters(&self) -> serde_json::Value {
    json!({
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "The spreadsheet file path (or omit/'active' for open document)."
        },
        "commands": {
          "type": "array",
          "description": "List of SpreadsheetCommand objects to execute in sequence.",
          "items": {
            "type": "object"
          }
        }
      },
      "required": ["commands"]
    })
  }

  async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
    call_frontend_tool(&self.app, &self.pending, Self::NAME, args).await
  }
}
