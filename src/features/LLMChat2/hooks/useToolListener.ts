import { useEffect, useRef, useCallback } from "react";
import { useSetAtom } from "jotai";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import {
  getUserAge,
  getUserCountry,
  getUserDob,
  getUserName,
  sumFourDigits,
  createFileTool,
  createFolderTool,
  renameFileTool,
  renameFolderTool,
  deleteFileOrFolderTool,
  moveFilesOrFoldersTool,
  listFilesTool,
  searchFileTool,
  readMarkdownTool,
  upsertMarkdownTool,
  upsertMarkdownSectionTool,
  addMarkdownCommentTool,
  searchKnowledgeBaseTool,
  writeSkillTool,
  getCurrentDatetimeTool,
  runShellTool,
  searchWebTool,
  fetchWebPageTool,
  CreateFileArgs,
  CreateFolderArgs,
  RenameFileArgs,
  RenameFolderArgs,
  DeleteFileOrFolderArgs,
  MoveFilesOrFoldersArgs,
  ListFilesArgs,
  SearchFileArgs,
  ReadMarkdownArgs,
  UpsertMarkdownArgs,
  UpsertMarkdownSectionArgs,
  AddMarkdownCommentArgs,
  SearchKnowledgeBaseArgs,
  WriteSkillArgs,
  GetCurrentDatetimeArgs,
  RunShellArgs,
  SearchWebArgs,
  FetchWebPageArgs,
  sheetReadTool,
  sheetGetDataTool,
  sheetGetCellTool,
  sheetCreateTool,
  sheetSetRangeDataTool,
  sheetEditCellTool,
  sheetClearRangeTool,
  sheetManageSheetTool,
  sheetModifyStructureTool,
  sheetFormatRangeTool,
  sheetExecuteCommandsTool,
  SheetReadArgs,
  SheetGetDataArgs,
  SheetGetCellArgs,
  SheetCreateArgs,
  SheetSetRangeDataArgs,
  SheetEditCellArgs,
  SheetClearRangeArgs,
  SheetManageSheetArgs,
  SheetModifyStructureArgs,
  SheetFormatRangeArgs,
  SheetExecuteCommandsArgs,
} from "../tools";

import {
  chat2LogsAtom,
  chat2MessagesAtom,
  activeToolCallAtom,
  ToolExecutionLog,
} from "../store/LLMChat2Store";

export interface ToolRequestPayload {
  request_id: string;
  tool_name: string;
  args: Record<string, unknown>;
}

export function useToolListener() {
  const setLogs = useSetAtom(chat2LogsAtom);
  const setMessages = useSetAtom(chat2MessagesAtom);
  const setActiveToolCall = useSetAtom(activeToolCallAtom);
  const processedRequestsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let isCancelled = false;
    let unlistenRequest: UnlistenFn | null = null;
    let unlistenLogEvent: UnlistenFn | null = null;

    // Listen for backend direct tool logs (e.g. generate_content)
    listen<ToolExecutionLog>("tool_log_event", (event) => {
      if (isCancelled) return;
      const log = event.payload;

      if (log.status === "executing") {
        setActiveToolCall(log);
        setLogs((prev) => [log, ...prev.filter((l) => l.requestId !== log.requestId)]);

        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const lastIdx = prev.length - 1;
          const lastMsg = prev[lastIdx];
          if (lastMsg.role === "assistant") {
            const currentTools = lastMsg.toolCalls || [];
            const nextTools = currentTools.some((tc) => tc.requestId === log.requestId)
              ? currentTools.map((tc) => (tc.requestId === log.requestId ? log : tc))
              : [...currentTools, log];

            const currentParts = lastMsg.parts ? [...lastMsg.parts] : [];
            const hasPart = currentParts.some(
              (p) => p.type === "tool" && p.toolCall.requestId === log.requestId
            );
            const nextParts = hasPart
              ? currentParts.map((p) =>
                  p.type === "tool" && p.toolCall.requestId === log.requestId
                    ? { ...p, toolCall: log }
                    : p
                )
              : [...currentParts, { type: "tool" as const, id: log.id, toolCall: log }];

            const next = [...prev];
            next[lastIdx] = { ...lastMsg, toolCalls: nextTools, parts: nextParts };
            return next;
          }
          return prev;
        });
      } else {
        // Success or Error
        setActiveToolCall(null);
        setLogs((prev) =>
          prev.map((l) => (l.requestId === log.requestId ? { ...l, ...log } : l))
        );

        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.role !== "assistant") return msg;
            const nextTools = msg.toolCalls?.map((tc) =>
              tc.requestId === log.requestId ? { ...tc, ...log } : tc
            );
            const nextParts = msg.parts?.map((p) => {
              if (p.type === "tool" && p.toolCall.requestId === log.requestId) {
                return {
                  ...p,
                  toolCall: { ...p.toolCall, ...log },
                };
              }
              return p;
            });
            return {
              ...msg,
              toolCalls: nextTools,
              parts: nextParts,
            };
          })
        );
      }
    }).then((unlisten) => {
      unlistenLogEvent = unlisten;
    });

    // Listen for frontend bridge tool requests
    listen<ToolRequestPayload>("tool_request", async (event) => {
      if (isCancelled) return;

      const { request_id, tool_name, args } = event.payload;

      // Deduplicate request handling
      if (processedRequestsRef.current.has(request_id)) return;
      processedRequestsRef.current.add(request_id);

      const logEntry: ToolExecutionLog = {
        id: crypto.randomUUID(),
        requestId: request_id,
        toolName: tool_name,
        args,
        status: "executing",
        timestamp: new Date(),
      };

      setActiveToolCall(logEntry);
      setLogs((prev) => [logEntry, ...prev]);

      // Attach tool call to the active/latest assistant message in chat
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const lastIdx = prev.length - 1;
        const lastMsg = prev[lastIdx];
        if (lastMsg.role === "assistant") {
          const currentTools = lastMsg.toolCalls || [];
          let currentParts = lastMsg.parts ? [...lastMsg.parts] : [];

          // Convert any text immediately preceding this tool call in the same turn into a thought part
          currentParts = currentParts.map((p, idx) => {
            if (p.type === "text" && idx === currentParts.length - 1 && p.content.trim()) {
              return {
                type: "thought" as const,
                id: p.id,
                content: p.content,
              };
            }
            return p;
          });

          const updatedMsg = {
            ...lastMsg,
            toolCalls: [...currentTools, logEntry],
            parts: [
              ...currentParts,
              {
                type: "tool" as const,
                id: logEntry.id,
                toolCall: logEntry,
              },
            ],
          };
          const next = [...prev];
          next[lastIdx] = updatedMsg;
          return next;
        }
        return prev;
      });

      try {
        let toolOutput: unknown;
        switch (tool_name) {
          case "get_user_name":
            toolOutput = getUserName(args as { id: number });
            break;
          case "get_user_age":
            toolOutput = getUserAge(args as { name: string });
            break;
          case "get_user_country":
            toolOutput = getUserCountry(args as { name: string });
            break;
          case "get_user_dob":
            toolOutput = getUserDob(args as { name: string });
            break;
          case "sum_four_digits":
            toolOutput = sumFourDigits(args as { a: number; b: number; c: number; d: number });
            break;
          case "create_file":
            toolOutput = await createFileTool(args as unknown as CreateFileArgs);
            break;
          case "create_folder":
            toolOutput = await createFolderTool(args as unknown as CreateFolderArgs);
            break;
          case "rename_file":
            toolOutput = await renameFileTool(args as unknown as RenameFileArgs);
            break;
          case "rename_folder":
            toolOutput = await renameFolderTool(args as unknown as RenameFolderArgs);
            break;
          case "delete_file_or_folder":
          case "delete_node":
            toolOutput = await deleteFileOrFolderTool(args as unknown as DeleteFileOrFolderArgs);
            break;
          case "move_files_or_folders":
          case "move_file_or_folder":
          case "move_files":
          case "cut_and_move":
            toolOutput = await moveFilesOrFoldersTool(args as unknown as MoveFilesOrFoldersArgs);
            break;
          case "list_files":
          case "list_directory":
          case "traverse_directory":
            toolOutput = await listFilesTool(args as unknown as ListFilesArgs);
            break;
          case "search_file":
          case "search_files":
          case "fuzzy_search_files":
            toolOutput = await searchFileTool(args as unknown as SearchFileArgs);
            break;
          case "read_markdown":

            toolOutput = await readMarkdownTool(args as unknown as ReadMarkdownArgs);
            break;
          case "upsert_markdown":
          case "update_markdown":
            toolOutput = await upsertMarkdownTool(args as unknown as UpsertMarkdownArgs);
            break;
          case "upsert_markdown_section":
          case "update_markdown_section":
            toolOutput = await upsertMarkdownSectionTool(args as unknown as UpsertMarkdownSectionArgs);
            break;
          case "add_markdown_comment":
            toolOutput = await addMarkdownCommentTool(args as unknown as AddMarkdownCommentArgs);
            break;
          case "search_knowledge_base":
          case "semantic_search":
          case "search_knowledge":
            toolOutput = await searchKnowledgeBaseTool(args as unknown as SearchKnowledgeBaseArgs);
            break;
          case "write_skill":
            toolOutput = await writeSkillTool(args as unknown as WriteSkillArgs);
            break;
          case "get_current_datetime":
          case "get_datetime":
            toolOutput = getCurrentDatetimeTool(args as unknown as GetCurrentDatetimeArgs);
            break;
          case "run_shell":
          case "execute_shell":
          case "shell_command":
          case "exec_command":
            toolOutput = await runShellTool(args as unknown as RunShellArgs);
            break;
          case "web_search":
          case "search_web":
          case "internet_search":
            toolOutput = await searchWebTool(args as unknown as SearchWebArgs);
            break;
          case "fetch_web_page":
          case "read_web_page":
          case "fetch_url":
          case "read_url":
            toolOutput = await fetchWebPageTool(args as unknown as FetchWebPageArgs);
            break;
          case "sheet_read":
          case "sheet_read_overview":
          case "read_spreadsheet":
            toolOutput = await sheetReadTool(args as unknown as SheetReadArgs);
            break;
          case "sheet_get_data":
          case "sheet_read_data":
          case "get_spreadsheet_data":
            toolOutput = await sheetGetDataTool(args as unknown as SheetGetDataArgs);
            break;
          case "sheet_get_cell":
          case "get_cell_value":
            toolOutput = await sheetGetCellTool(args as unknown as SheetGetCellArgs);
            break;
          case "sheet_create":
          case "create_spreadsheet":
            toolOutput = await sheetCreateTool(args as unknown as SheetCreateArgs);
            break;
          case "sheet_set_range_data":
          case "set_range_data":
            toolOutput = await sheetSetRangeDataTool(args as unknown as SheetSetRangeDataArgs);
            break;
          case "sheet_edit_cell":
          case "edit_cell":
          case "set_cell_value":
            toolOutput = await sheetEditCellTool(args as unknown as SheetEditCellArgs);
            break;
          case "sheet_clear_range":
          case "clear_range":
            toolOutput = await sheetClearRangeTool(args as unknown as SheetClearRangeArgs);
            break;
          case "sheet_manage_sheet":
          case "manage_spreadsheet_sheet":
            toolOutput = await sheetManageSheetTool(args as unknown as SheetManageSheetArgs);
            break;
          case "sheet_modify_structure":
          case "modify_spreadsheet_structure":
            toolOutput = await sheetModifyStructureTool(args as unknown as SheetModifyStructureArgs);
            break;
          case "sheet_format_range":
          case "format_spreadsheet_range":
            toolOutput = await sheetFormatRangeTool(args as unknown as SheetFormatRangeArgs);
            break;
          case "sheet_execute_commands":
          case "execute_spreadsheet_commands":
            toolOutput = await sheetExecuteCommandsTool(args as unknown as SheetExecuteCommandsArgs);
            break;
          default:
            throw new Error(`Unknown tool: ${tool_name}`);
        }

        // Update card to Success in logs
        setLogs((prev) =>
          prev.map((l) =>
            l.requestId === request_id ? { ...l, result: toolOutput, status: "success" } : l
          )
        );

        // Update tool call in chat message
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.role !== "assistant") return msg;
            const updatedTools = msg.toolCalls?.map((tc) =>
              tc.requestId === request_id
                ? { ...tc, result: toolOutput, status: "success" as const }
                : tc
            );
            const updatedParts = msg.parts?.map((p) => {
              if (p.type === "tool" && p.toolCall.requestId === request_id) {
                return {
                  ...p,
                  toolCall: {
                    ...p.toolCall,
                    result: toolOutput,
                    status: "success" as const,
                  },
                };
              }
              return p;
            });
            return {
              ...msg,
              toolCalls: updatedTools,
              parts: updatedParts,
            };
          })
        );

        setActiveToolCall(null);

        // Send output back to Rust backend (llm2)
        await invoke("llm2_tool_result", {
          requestId: request_id,
          result: { Ok: toolOutput },
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setLogs((prev) =>
          prev.map((l) =>
            l.requestId === request_id ? { ...l, error: errorMsg, status: "error" } : l
          )
        );

        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.role !== "assistant") return msg;
            const updatedTools = msg.toolCalls?.map((tc) =>
              tc.requestId === request_id
                ? { ...tc, error: errorMsg, status: "error" as const }
                : tc
            );
            const updatedParts = msg.parts?.map((p) => {
              if (p.type === "tool" && p.toolCall.requestId === request_id) {
                return {
                  ...p,
                  toolCall: {
                    ...p.toolCall,
                    error: errorMsg,
                    status: "error" as const,
                  },
                };
              }
              return p;
            });
            return {
              ...msg,
              toolCalls: updatedTools,
              parts: updatedParts,
            };
          })
        );

        setActiveToolCall(null);

        await invoke("llm2_tool_result", {
          requestId: request_id,
          result: { Err: errorMsg },
        });
      }
    }).then((unlisten) => {
      unlistenRequest = unlisten;
    });

    return () => {
      isCancelled = true;
      if (unlistenRequest) {
        unlistenRequest();
        unlistenRequest = null;
      }
      if (unlistenLogEvent) {
        unlistenLogEvent();
        unlistenLogEvent = null;
      }
    };
  }, [setActiveToolCall, setLogs, setMessages]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    processedRequestsRef.current.clear();
    setActiveToolCall(null);
  }, [setActiveToolCall, setLogs]);

  return { clearLogs };
}
