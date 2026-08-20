use rig::client::{CompletionClient, Nothing};
use rig::completion::message::{AssistantContent, ToolResultContent, UserContent};
use rig::completion::{CompletionModel, Message};
use rig::providers::ollama;
use rig::tool::{portable_tool_definition, PortableTool};
use tauri::AppHandle;

use super::pending::PendingRequests;
use super::tools::{
    CreateFileArgs, CreateFileTool, CreateFolderArgs, CreateFolderTool,
    DeleteFileOrFolderArgs, DeleteFileOrFolderTool, GetUserAgeArgs, GetUserAgeTool,
    GetUserCountryArgs, GetUserCountryTool, GetUserDobArgs, GetUserDobTool,
    GetUserNameArgs, GetUserNameTool, RenameFileArgs, RenameFileTool,
    RenameFolderArgs, RenameFolderTool, SumFourDigitsArgs, SumFourDigitsTool,
};

const SYSTEM_PROMPT: &str = "\
You are a helpful and precise AI desktop assistant for the Depdok document editor.
You have access to file management and utility tools:
- 'create_file': Create a new file with optional content (e.g. 'notes.md', 'plan.txt').
- 'create_folder': Create a new folder (e.g. 'docs', 'src/components').
- 'rename_file': Rename an existing file (e.g. old_path: 'old.md', new_name: 'new.md').
- 'rename_folder': Rename an existing folder (e.g. old_path: 'old_folder', new_name: 'new_folder').
- 'delete_file_or_folder': Delete a file or folder from the workspace.
- 'get_user_name': Look up user name by ID.
- 'get_user_age': Get user's age by name.
- 'get_user_country': Get user's country by name.
- 'get_user_dob': Get user's date of birth by name.
- 'sum_four_digits': Sum 4 numbers.

IMPORTANT RULES:
- When a user asks you to create, rename, or delete a file or folder, call the appropriate tool.
- If multiple operations are requested (e.g. 'create folder docs and create file docs/readme.md'), execute the tools in the proper order.
- Once all tool results are provided, synthesize a clear summary of the actions performed.";

pub async fn prompt_agent(
    app: AppHandle,
    pending: PendingRequests,
    prompt: &str,
    model_name: Option<String>,
) -> Result<String, String> {
    let client = ollama::Client::new(Nothing).map_err(|e| e.to_string())?;
    let model_to_use = model_name.unwrap_or_else(|| "qwen3.5:4b".to_string());
    let model = client.completion_model(&model_to_use);

    let sum_tool = SumFourDigitsTool { app: app.clone(), pending: pending.clone() };
    let user_name_tool = GetUserNameTool { app: app.clone(), pending: pending.clone() };
    let user_age_tool = GetUserAgeTool { app: app.clone(), pending: pending.clone() };
    let user_country_tool = GetUserCountryTool { app: app.clone(), pending: pending.clone() };
    let user_dob_tool = GetUserDobTool { app: app.clone(), pending: pending.clone() };

    let create_file_tool = CreateFileTool { app: app.clone(), pending: pending.clone() };
    let create_folder_tool = CreateFolderTool { app: app.clone(), pending: pending.clone() };
    let rename_file_tool = RenameFileTool { app: app.clone(), pending: pending.clone() };
    let rename_folder_tool = RenameFolderTool { app: app.clone(), pending: pending.clone() };
    let delete_tool = DeleteFileOrFolderTool { app: app.clone(), pending: pending.clone() };

    let tool_defs = vec![
        portable_tool_definition(&sum_tool),
        portable_tool_definition(&user_name_tool),
        portable_tool_definition(&user_age_tool),
        portable_tool_definition(&user_country_tool),
        portable_tool_definition(&user_dob_tool),
        portable_tool_definition(&create_file_tool),
        portable_tool_definition(&create_folder_tool),
        portable_tool_definition(&rename_file_tool),
        portable_tool_definition(&rename_folder_tool),
        portable_tool_definition(&delete_tool),
    ];

    // Seed history with initial user prompt so multi-turn loop retains full context
    let mut history: Vec<Message> = vec![Message::User {
        content: vec![UserContent::text(prompt)],
    }];

    // Multi-turn resolution loop
    for _turn in 0..6 {
        let request = model
            .completion_request("")
            .preamble(SYSTEM_PROMPT.to_string())
            .messages(history.clone())
            .tools(tool_defs.clone())
            .build();

        let response = model
            .completion(request)
            .await
            .map_err(|e| format!("Ollama completion error: {}", e))?;

        let mut has_tool_call = false;
        let mut text_parts = Vec::new();
        let mut assistant_contents = Vec::new();
        let mut tool_results_to_add = Vec::new();

        // Process all items in response.choice (handles single or multiple simultaneous tool calls)
        for content in response.choice {
            match content {
                AssistantContent::Text(t) => {
                    text_parts.push(t.text.clone());
                    assistant_contents.push(AssistantContent::Text(t));
                }
                AssistantContent::ToolCall(tool_call) => {
                    has_tool_call = true;
                    let call_name = tool_call.function.name.clone();
                    let call_id = tool_call.id.clone();
                    let provider_call_id = tool_call.provider.clone();

                    let tool_result_value = match call_name.as_str() {
                        "get_user_name" => {
                            let args: GetUserNameArgs = serde_json::from_value(tool_call.function.arguments.clone())
                                .map_err(|e| e.to_string())?;
                            user_name_tool.call(args).await.map_err(|e| e.to_string())?
                        }
                        "get_user_age" => {
                            let args: GetUserAgeArgs = serde_json::from_value(tool_call.function.arguments.clone())
                                .map_err(|e| e.to_string())?;
                            user_age_tool.call(args).await.map_err(|e| e.to_string())?
                        }
                        "get_user_country" => {
                            let args: GetUserCountryArgs = serde_json::from_value(tool_call.function.arguments.clone())
                                .map_err(|e| e.to_string())?;
                            user_country_tool.call(args).await.map_err(|e| e.to_string())?
                        }
                        "get_user_dob" => {
                            let args: GetUserDobArgs = serde_json::from_value(tool_call.function.arguments.clone())
                                .map_err(|e| e.to_string())?;
                            user_dob_tool.call(args).await.map_err(|e| e.to_string())?
                        }
                        "sum_four_digits" => {
                            let args: SumFourDigitsArgs = serde_json::from_value(tool_call.function.arguments.clone())
                                .map_err(|e| e.to_string())?;
                            sum_tool.call(args).await.map_err(|e| e.to_string())?
                        }
                        "create_file" => {
                            let args: CreateFileArgs = serde_json::from_value(tool_call.function.arguments.clone())
                                .map_err(|e| e.to_string())?;
                            create_file_tool.call(args).await.map_err(|e| e.to_string())?
                        }
                        "create_folder" => {
                            let args: CreateFolderArgs = serde_json::from_value(tool_call.function.arguments.clone())
                                .map_err(|e| e.to_string())?;
                            create_folder_tool.call(args).await.map_err(|e| e.to_string())?
                        }
                        "rename_file" => {
                            let args: RenameFileArgs = serde_json::from_value(tool_call.function.arguments.clone())
                                .map_err(|e| e.to_string())?;
                            rename_file_tool.call(args).await.map_err(|e| e.to_string())?
                        }
                        "rename_folder" => {
                            let args: RenameFolderArgs = serde_json::from_value(tool_call.function.arguments.clone())
                                .map_err(|e| e.to_string())?;
                            rename_folder_tool.call(args).await.map_err(|e| e.to_string())?
                        }
                        "delete_file_or_folder" => {
                            let args: DeleteFileOrFolderArgs = serde_json::from_value(tool_call.function.arguments.clone())
                                .map_err(|e| e.to_string())?;
                            delete_tool.call(args).await.map_err(|e| e.to_string())?
                        }
                        unknown => return Err(format!("Unknown tool: {}", unknown)),
                    };

                    assistant_contents.push(AssistantContent::ToolCall(tool_call));
                    let result_content = ToolResultContent::json(tool_result_value);
                    tool_results_to_add.push((call_id, provider_call_id, call_name, vec![result_content]));
                }
                other => assistant_contents.push(other),
            }
        }

        // If no tool was called, we have our final text answer
        if !has_tool_call {
            return Ok(text_parts.join("\n"));
        }

        // Record assistant turn in history
        history.push(Message::Assistant {
            id: None,
            content: assistant_contents,
        });

        // Record all tool results in history
        for (call_id, provider_call_id, call_name, contents) in tool_results_to_add {
            history.push(Message::User {
                content: vec![UserContent::tool_result_for(call_id, provider_call_id, call_name, contents)],
            });
        }
    }

    Err("Exceeded maximum tool calling turns".to_string())
}
