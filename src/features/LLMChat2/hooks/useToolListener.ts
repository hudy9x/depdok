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
  readMarkdownTool,
  upsertMarkdownTool,
  upsertMarkdownSectionTool,
  addMarkdownCommentTool,
  CreateFileArgs,
  CreateFolderArgs,
  RenameFileArgs,
  RenameFolderArgs,
  DeleteFileOrFolderArgs,
  ReadMarkdownArgs,
  UpsertMarkdownArgs,
  UpsertMarkdownSectionArgs,
  AddMarkdownCommentArgs,
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
            const next = [...prev];
            next[lastIdx] = { ...lastMsg, toolCalls: nextTools };
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
            if (msg.role !== "assistant" || !msg.toolCalls) return msg;
            return {
              ...msg,
              toolCalls: msg.toolCalls.map((tc) =>
                tc.requestId === log.requestId ? { ...tc, ...log } : tc
              ),
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
          const updatedMsg = {
            ...lastMsg,
            toolCalls: [...currentTools, logEntry],
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
            if (msg.role !== "assistant" || !msg.toolCalls) return msg;
            return {
              ...msg,
              toolCalls: msg.toolCalls.map((tc) =>
                tc.requestId === request_id
                  ? { ...tc, result: toolOutput, status: "success" }
                  : tc
              ),
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
            if (msg.role !== "assistant" || !msg.toolCalls) return msg;
            return {
              ...msg,
              toolCalls: msg.toolCalls.map((tc) =>
                tc.requestId === request_id
                  ? { ...tc, error: errorMsg, status: "error" }
                  : tc
              ),
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
