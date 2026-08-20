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
  CreateFileArgs,
  CreateFolderArgs,
  RenameFileArgs,
  RenameFolderArgs,
  DeleteFileOrFolderArgs,
} from "../tools";
import {
  chat2LogsAtom,
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
  const setActiveToolCall = useSetAtom(activeToolCallAtom);
  const processedRequestsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let isCancelled = false;
    let unlistenFn: UnlistenFn | null = null;

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
          default:
            throw new Error(`Unknown tool: ${tool_name}`);
        }

        // Update card to Success
        setLogs((prev) =>
          prev.map((l) =>
            l.requestId === request_id ? { ...l, result: toolOutput, status: "success" } : l
          )
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
        setActiveToolCall(null);

        await invoke("llm2_tool_result", {
          requestId: request_id,
          result: { Err: errorMsg },
        });
      }
    }).then((unlisten) => {
      if (isCancelled) {
        unlisten();
      } else {
        unlistenFn = unlisten;
      }
    });

    return () => {
      isCancelled = true;
      if (unlistenFn) {
        unlistenFn();
        unlistenFn = null;
      }
    };
  }, [setActiveToolCall, setLogs]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    processedRequestsRef.current.clear();
    setActiveToolCall(null);
  }, [setActiveToolCall, setLogs]);

  return { clearLogs };
}
