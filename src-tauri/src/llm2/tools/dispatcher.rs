use rig::tool::PortableTool;
use serde_json::json;
use tauri::{AppHandle, Emitter};

use crate::llm2::runtime::PendingRequests;
use crate::mcp_client::McpClientManager;

use super::{
  AddMarkdownCommentTool, CreateFileTool, CreateFolderTool, DeleteFileOrFolderTool,
  GenerateContentTool, GetCurrentDatetimeTool, GetUserAgeTool, GetUserCountryTool,
  GetUserDobTool, GetUserNameTool, ListFilesTool, MoveFilesOrFoldersTool,
  ReadMarkdownTool, RenameFileTool, RenameFolderTool, RunShellTool,
  SearchKnowledgeBaseTool, ListKnowledgeBaseProjectsTool, ListKnowledgeBaseGroupsTool, SumFourDigitsTool, UpsertMarkdownSectionTool,
  UpsertMarkdownTool, WebSearchTool, FetchWebPageTool, WriteSkillTool,
  McpVerifyConfigTool, McpTestServerTool, McpListServersTool, McpReloadTool,
  SearchFileTool, ReloadSkillsTool,
  SheetReadTool, SheetGetDataTool, SheetGetCellTool, SheetCreateTool,
  SheetSetRangeDataTool, SheetEditCellTool, SheetClearRangeTool,
  SheetManageSheetTool, SheetModifyStructureTool, SheetFormatRangeTool,
  SheetExecuteCommandsTool,
};

/// Dispatches a tool call by name to either the internal built-in tools or active MCP servers.
pub async fn dispatch_tool_call(
  app: &AppHandle,
  pending: &PendingRequests,
  mcp_manager: Option<&McpClientManager>,
  default_content_model: &str,
  call_name: &str,
  call_args: serde_json::Value,
) -> Result<serde_json::Value, String> {
  println!("[llm2][dispatcher] Executing '{}' with args: {:?}", call_name, call_args);

  match call_name {
    "generate_content" => {
      let tool = GenerateContentTool {
        app: app.clone(),
        default_content_model: Some(default_content_model.to_string()),
      };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for generate_content: {}", e)),
      }
    }
    "get_user_name" => {
      let tool = GetUserNameTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for get_user_name: {}", e)),
      }
    }
    "get_user_age" => {
      let tool = GetUserAgeTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for get_user_age: {}", e)),
      }
    }
    "get_user_country" => {
      let tool = GetUserCountryTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for get_user_country: {}", e)),
      }
    }
    "get_user_dob" => {
      let tool = GetUserDobTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for get_user_dob: {}", e)),
      }
    }
    "sum_four_digits" => {
      let tool = SumFourDigitsTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for sum_four_digits: {}", e)),
      }
    }
    "create_file" => {
      let tool = CreateFileTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for create_file: {}", e)),
      }
    }
    "create_folder" => {
      let tool = CreateFolderTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for create_folder: {}", e)),
      }
    }
    "rename_file" => {
      let tool = RenameFileTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for rename_file: {}", e)),
      }
    }
    "rename_folder" => {
      let tool = RenameFolderTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for rename_folder: {}", e)),
      }
    }
    "delete_file_or_folder" | "delete_node" => {
      let tool = DeleteFileOrFolderTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for delete_file_or_folder: {}", e)),
      }
    }
    "move_files_or_folders" | "move_file_or_folder" | "move_files" | "cut_and_move" => {
      let tool = MoveFilesOrFoldersTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for move_files_or_folders: {}", e)),
      }
    }
    "list_files" | "list_directory" | "traverse_directory" => {
      let tool = ListFilesTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for list_files: {}", e)),
      }
    }
    "search_file" | "search_files" | "fuzzy_search_files" => {
      let tool = SearchFileTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for search_file: {}", e)),
      }
    }
    "read_markdown" => {
      let tool = ReadMarkdownTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for read_markdown: {}", e)),
      }
    }
    "upsert_markdown" | "update_markdown" => {
      let tool = UpsertMarkdownTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for upsert_markdown: {}", e)),
      }
    }
    "upsert_markdown_section" | "update_markdown_section" => {
      let tool = UpsertMarkdownSectionTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for upsert_markdown_section: {}", e)),
      }
    }
    "add_markdown_comment" => {
      let tool = AddMarkdownCommentTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for add_markdown_comment: {}", e)),
      }
    }
    "search_knowledge_base" | "semantic_search" | "search_knowledge" => {
      let tool = SearchKnowledgeBaseTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for search_knowledge_base: {}", e)),
      }
    }
    "list_knowledge_base_projects" | "list_projects" | "get_projects" => {
      let tool = ListKnowledgeBaseProjectsTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for list_knowledge_base_projects: {}", e)),
      }
    }
    "list_knowledge_base_groups" | "list_groups" | "get_groups" => {
      let tool = ListKnowledgeBaseGroupsTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for list_knowledge_base_groups: {}", e)),
      }
    }
    "write_skill" => {
      let tool = WriteSkillTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for write_skill: {}", e)),
      }
    }
    "get_current_datetime" | "get_datetime" => {
      let tool = GetCurrentDatetimeTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for get_current_datetime: {}", e)),
      }
    }
    "run_shell" | "execute_shell" | "shell_command" | "exec_command" => {
      let tool = RunShellTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for run_shell: {}", e)),
      }
    }
    "web_search" | "search_web" | "internet_search" => {
      let tool = WebSearchTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for web_search: {}", e)),
      }
    }
    "fetch_web_page" | "read_web_page" | "fetch_url" | "read_url" => {
      let tool = FetchWebPageTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for fetch_web_page: {}", e)),
      }
    }
    "mcp_verify_config" | "mcp-verify-config" | "verify_mcp_config" => {
      let tool = McpVerifyConfigTool { app: app.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for mcp_verify_config: {}", e)),
      }
    }
    "mcp_test_server" | "mcp-test-server" | "test_mcp_server" => {
      let tool = McpTestServerTool { app: app.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for mcp_test_server: {}", e)),
      }
    }
    "mcp_list_servers" | "mcp-list-servers" | "list_mcp_servers" => {
      let tool = McpListServersTool { app: app.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for mcp_list_servers: {}", e)),
      }
    }
    "mcp_reload" | "mcp-reload" | "reload_mcp" => {
      let tool = McpReloadTool { app: app.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for mcp_reload: {}", e)),
      }
    }
    "reload_skills" | "skill_reload" | "reload-skills" => {
      let tool = ReloadSkillsTool { app: app.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for reload_skills: {}", e)),
      }
    }
    "sheet_read" | "sheet_read_overview" | "read_spreadsheet" => {
      let tool = SheetReadTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for sheet_read: {}", e)),
      }
    }
    "sheet_get_data" | "sheet_read_data" | "get_spreadsheet_data" => {
      let tool = SheetGetDataTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for sheet_get_data: {}", e)),
      }
    }
    "sheet_get_cell" | "get_cell_value" => {
      let tool = SheetGetCellTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for sheet_get_cell: {}", e)),
      }
    }
    "sheet_create" | "create_spreadsheet" => {
      let tool = SheetCreateTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for sheet_create: {}", e)),
      }
    }
    "sheet_set_range_data" | "set_range_data" => {
      let tool = SheetSetRangeDataTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for sheet_set_range_data: {}", e)),
      }
    }
    "sheet_edit_cell" | "edit_cell" | "set_cell_value" => {
      let tool = SheetEditCellTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for sheet_edit_cell: {}", e)),
      }
    }
    "sheet_clear_range" | "clear_range" => {
      let tool = SheetClearRangeTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for sheet_clear_range: {}", e)),
      }
    }
    "sheet_manage_sheet" | "manage_spreadsheet_sheet" => {
      let tool = SheetManageSheetTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for sheet_manage_sheet: {}", e)),
      }
    }
    "sheet_modify_structure" | "modify_spreadsheet_structure" => {
      let tool = SheetModifyStructureTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for sheet_modify_structure: {}", e)),
      }
    }
    "sheet_format_range" | "format_spreadsheet_range" => {
      let tool = SheetFormatRangeTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for sheet_format_range: {}", e)),
      }
    }
    "sheet_execute_commands" | "execute_spreadsheet_commands" => {
      let tool = SheetExecuteCommandsTool { app: app.clone(), pending: pending.clone() };
      match serde_json::from_value(call_args) {
        Ok(args) => tool.call(args).await.map_err(|e| e.to_string()),
        Err(e) => Err(format!("Invalid arguments for sheet_execute_commands: {}", e)),
      }
    }
    unknown => {
      let log_id = uuid::Uuid::new_v4().to_string();
      let req_id = uuid::Uuid::new_v4().to_string();

      // Emit executing event to frontend so tool card appears immediately
      let _ = app.emit("tool_log_event", json!({
        "id": log_id,
        "requestId": req_id,
        "toolName": unknown,
        "args": call_args,
        "status": "executing",
        "timestamp": chrono::Utc::now().to_rfc3339()
      }));

      if let Some(mgr) = mcp_manager {
        if mgr.has_tool(unknown).await {
          match mgr.call_tool(unknown, call_args.clone()).await {
            Ok(res) => {
              let _ = app.emit("tool_log_event", json!({
                "id": log_id,
                "requestId": req_id,
                "toolName": unknown,
                "args": call_args,
                "result": res,
                "status": "success",
                "timestamp": chrono::Utc::now().to_rfc3339()
              }));
              Ok(res)
            }
            Err(e) => {
              let _ = app.emit("tool_log_event", json!({
                "id": log_id,
                "requestId": req_id,
                "toolName": unknown,
                "args": call_args,
                "status": "error",
                "error": e,
                "timestamp": chrono::Utc::now().to_rfc3339()
              }));
              Err(e)
            }
          }
        } else {
          let err_msg = format!("Unknown tool: {}", unknown);
          let _ = app.emit("tool_log_event", json!({
            "id": log_id,
            "requestId": req_id,
            "toolName": unknown,
            "args": call_args,
            "status": "error",
            "error": err_msg,
            "timestamp": chrono::Utc::now().to_rfc3339()
          }));
          Err(err_msg)
        }
      } else {
        let err_msg = format!("Unknown tool: {}", unknown);
        let _ = app.emit("tool_log_event", json!({
          "id": log_id,
          "requestId": req_id,
          "toolName": unknown,
          "args": call_args,
          "status": "error",
          "error": err_msg,
          "timestamp": chrono::Utc::now().to_rfc3339()
        }));
        Err(err_msg)
      }
    }
  }
}
